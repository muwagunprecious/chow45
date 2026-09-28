/**
 * CHOW45 MAPBOX GL JS SERVICE
 * Location, geocoding, route, delivery-quote, and live tracking for Chow45.
 *
 * - Lazy map creation (no unnecessary re-creation, maps cached per container)
 * - GPS accuracy circle validation
 * - Reverse geocoding -> structured address (street, locality, LGA, state)
 * - Forward geocoding search (debounced + cached)
 * - Mapbox Directions route (real road distance, not straight-line)
 * - Delivery quote with server-side validation fallback
 * - Service-zone validation via coordinates (see service-zones.js)
 * - Chow45 green custom markers and light map style
 */

class MapboxService {
  constructor() {
    this.maps = {};             // containerId -> map instance (reuse, never recreate)
    this.markers = {};          // logical marker refs (store/customer/rider/user)
    this.pixelMarkers = {};     // raw mapboxgl.Marker refs for cleanup
    this.routeAnimationTimer = null;
    this.geocodeCache = new Map();    // query -> results
    this.reverseCache = new Map();    // 'lng,lat' -> structured address
    this.searchDebounceTimer = null;
    this.moveDebounceTimer = null;
    this.onMoveSettled = null;
    this.isLoaded = false;
    this.token = (window.CHOW45_MAPBOX_CONFIG || {}).token || '';
  }

  // -------------------------------------------------------------
  // LIB & TOKEN
  // -------------------------------------------------------------
  isReady() {
    return Boolean(this.token && typeof window.mapboxgl !== 'undefined');
  }

  /**
   * Dynamically load Mapbox GL JS + CSS (used if the static <script> tag fails).
   */
  loadLib() {
    return new Promise((resolve) => {
      if (typeof window.mapboxgl !== 'undefined') return resolve(true);
      const link = document.querySelector('link[href*="mapbox-gl"]');
      if (!link) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css';
        document.head.appendChild(l);
      }
      const s = document.createElement('script');
      s.src = 'https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.js';
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  // -------------------------------------------------------------
  // MAP INIT (cached per container)
  // -------------------------------------------------------------
  async initMap(containerId = 'mapbox-canvas', opts = {}) {
    const center = opts.center || opts.initialCenter || [3.6545, 6.8482];

    if (this.maps[containerId]) {
      const existing = this.maps[containerId];
      if (!existing.isStyleLoaded()) {
        await new Promise((resolve) => {
          const onReady = () => resolve();
          existing.once('load', onReady);
          existing.once('style.load', onReady);
          setTimeout(onReady, 2500);
        });
      }
      return existing;
    }

    if (!this.token) {
      console.error('Mapbox unavailable: token missing.');
      return null;
    }

    await this.loadLib();
    if (typeof window.mapboxgl === 'undefined') {
      console.error('Mapbox GL JS failed to load.');
      return null;
    }

    mapboxgl.accessToken = this.token;

    try {
      const map = new mapboxgl.Map({
        container: containerId,
        style: CHOW45_MAPBOX_CONFIG.style,
        center,
        zoom: opts.zoom || 14.5,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }), 'top-right');
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

      map.on('load', () => {
        this.isLoaded = true;
        this._applyGoogleLook(map);
        this._setupRouteLayer(map);
        this._setupZoneLayers(map);
        map.resize();
        if (opts.onLoad) opts.onLoad(map);
      });

      map.on('style.load', () => this._applyGoogleLook(map));

      map.on('moveend', () => this._onMapSettled(map, opts));

      this.maps[containerId] = map;

      // Wait until style has loaded before returning
      await new Promise((resolve) => {
        if (map.isStyleLoaded() || map.loaded()) {
          resolve();
        } else {
          const onDone = () => {
            map.off('load', onDone);
            map.off('style.load', onDone);
            resolve();
          };
          map.once('load', onDone);
          map.once('style.load', onDone);
          map.once('error', (err) => {
            console.warn('Mapbox error during init:', err);
            resolve();
          });
          setTimeout(onDone, 5000);
        }
      });

      return map;
    } catch (e) {
      console.error('Error initializing Mapbox:', e);
      return null;
    }
  }

  /**
   * Retune the base Mapbox style toward Google Maps' visual palette.
   * Safe: every layer lookup is try/caught, wrong ids are simply skipped.
   */
  _applyGoogleLook(map) {
    const cfg = CHOW45_MAPBOX_CONFIG;
    if (!cfg.applyGoogleLook || !map || typeof map.getStyle !== 'function') return;

    let layers = [];
    try {
      layers = (map.getStyle() && map.getStyle().layers) || [];
    } catch (e) {
      return;
    }
    if (!layers.length) return;

    const P = cfg.googlePalette || {};
    const setPaint = (id, prop, val) => {
      try { if (map.getLayer(id)) map.setPaintProperty(id, prop, val); } catch (e) {}
    };

    layers.forEach(l => {
      const id = l.id || '';
      const t = l.type || '';
      try {
        if (t === 'background') {
          setPaint(id, 'background-color', P.land || '#F1F0ED');
          return;
        }
        const isWater = id.indexOf('water') > -1;
        const isPark = id.indexOf('park') > -1 || id.indexOf('woodland') > -1 || /(grass|recreation|bush)/i.test(id);
        const isBuilding = id.indexOf('building') > -1;
        const isCasing = id.indexOf('casing') > -1;
        const isRoad = /road|motorway|trunk|arterial|highway/i.test(id);
        const isBoundary = t === 'line' && /boundary|borderline/i.test(id);

        if (isWater && t === 'fill') setPaint(id, 'fill-color', P.water || '#A9C6EB');
        if (isWater && t === 'line') setPaint(id, 'line-color', P.water || '#A9C6EB');
        if (isPark && t === 'fill') setPaint(id, 'fill-color', P.park || '#C6E8B3');
        if (isBuilding && t === 'fill') setPaint(id, 'fill-color', P.building || '#E4E2DB');
        if (isBoundary) setPaint(id, 'line-color', P.boundary || '#8C8C8C');

        if (isRoad && t === 'line') {
          if (isCasing) {
            setPaint(id, 'line-color', P.localRoadCasing || '#DDDDDD');
          } else {
            const major = /motorway|trunk|primary|secondary|arterial/i.test(id);
            setPaint(id, 'line-color', major ? (P.majorRoad || '#FFCB8F') : (P.localRoad || '#FFFFFF'));
          }
        }
      } catch (e) {}
    });
  }

  getMap(containerId) {
    return this.maps[containerId] || null;
  }

  _onMapSettled(map, opts) {
    clearTimeout(this.moveDebounceTimer);
    const cb = this.onMoveSettled || opts.onMoveSettled;
    if (!cb) return;
    this.moveDebounceTimer = setTimeout(() => {
      const c = map.getCenter();
      cb({ lng: c.lng, lat: c.lat });
    }, CHOW45_MAPBOX_CONFIG.moveSettleMs);
  }

  getCenter(containerId) {
    const map = this.getMap(containerId);
    if (!map) return null;
    const c = map.getCenter();
    return { lng: c.lng, lat: c.lat };
  }

  flyTo(containerId, lng, lat, zoom = 15) {
    const map = this.getMap(containerId);
    if (map) map.flyTo({ center: [lng, lat], zoom, duration: 1200 });
  }

  fitBounds(containerId, coords, padding = 80) {
    const map = this.getMap(containerId);
    if (!map || !coords || coords.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach(c => bounds.extend(c));
    map.fitBounds(bounds, { padding, duration: 900, maxZoom: 15.5 });
  }

  resize() {
    Object.keys(this.maps).forEach(id => {
      setTimeout(() => {
        const m = this.maps[id];
        if (m && m.resize) m.resize();
      }, 80);
    });
  }

  // -------------------------------------------------------------
  // LAYERS
  // -------------------------------------------------------------
  _setupRouteLayer(map) {
    if (!map.getSource('chow45-route')) {
      const cfg = CHOW45_MAPBOX_CONFIG;
      map.addSource('chow45-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
      });
      map.addLayer({
        id: 'route-line-casing', type: 'line', source: 'chow45-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': cfg.routeCasing || '#FFFFFF', 'line-width': cfg.routeCasingWidth || 7 }
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'chow45-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': cfg.routeColor || '#1A73E8', 'line-width': cfg.routeWidth || 4 }
      });
    }
  }

  _setupZoneLayers(map) {
    if (map.getSource('chow45-zones')) return;
    const zones = (window.CHOW45_SERVICE_ZONES || []).filter(z => z.polygon && z.polygon.length);
    const features = zones.map(z => ({
      type: 'Feature',
      properties: { id: z.id, name: z.name, active: !!z.active },
      geometry: { type: 'Polygon', coordinates: [z.polygon] }
    }));
    map.addSource('chow45-zones', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    });
    map.addLayer({
      id: 'zones-fill', type: 'fill', source: 'chow45-zones',
      paint: {
        'fill-color': [
          'case',
          ['get', 'active'], CHOW45_MAPBOX_CONFIG.zoneFillColor, '#9CA3AF'
        ],
        'fill-opacity': CHOW45_MAPBOX_CONFIG.zoneFillOpacity,
        'fill-outline-color': ['case', ['get', 'active'], '#0C513F', '#9CA3AF']
      }
    });
    map.addLayer({
      id: 'zones-outline', type: 'line', source: 'chow45-zones',
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['get', 'active'], CHOW45_MAPBOX_CONFIG.zoneLineColor, '#9CA3AF'],
        'line-width': 2,
        'line-dasharray': [4, 2]
      }
    });
  }

  renderServiceZones(containerId) {
    const map = this.getMap(containerId);
    if (map && map.getSource('chow45-zones')) {
      const zones = (window.CHOW45_SERVICE_ZONES || []).filter(z => z.polygon && z.polygon.length);
      map.getSource('chow45-zones').setData({
        type: 'FeatureCollection',
        features: zones.map(z => ({
          type: 'Feature',
          properties: { id: z.id, name: z.name, active: !!z.active },
          geometry: { type: 'Polygon', coordinates: [z.polygon] }
        }))
      });
    }
  }

  // -------------------------------------------------------------
  // MARKERS
  // -------------------------------------------------------------
  _pinElement(type, color) {
    const el = document.createElement('div');
    el.className = `marker-pin marker-${type}`;
    if (color) el.style.setProperty('--marker-color', color);
    return el;
  }

  _userPinElement() {
    return this._pinElement('user');
  }

  addMarker(map, type, lngLat, opts = {}) {
    const el = this._pinElement(type);
    const svg = opts.svg || '';
    if (svg) el.innerHTML = svg;
    const marker = new mapboxgl.Marker({ element: el, anchor: opts.anchor || 'center' })
      .setLngLat([lngLat.lng ?? lngLat[0], lngLat.lat ?? lngLat[1]]);

    if (opts.popupHtml) {
      marker.setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(opts.popupHtml));
    }
    if (opts.draggable) marker.setDraggable(true);
    marker.addTo(map);
    return marker;
  }

  _removePixelMarkers() {
    Object.keys(this.pixelMarkers).forEach(k => {
      try { this.pixelMarkers[k].remove(); } catch (e) {}
    });
    this.pixelMarkers = {};
  }

  /**
   * Geographic GPS accuracy circle (updates with zoom).
   */
  showAccuracyCircle(map, lngLat, accuracyMeters) {
    if (!map || !map.isStyleLoaded() || !accuracyMeters || accuracyMeters <= 0) return;
    if (!map.getSource('gps-accuracy')) {
      map.addSource('gps-accuracy', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] } }
      });
      map.addLayer({
        id: 'gps-accuracy-circle', type: 'circle', source: 'gps-accuracy',
        paint: {
          'circle-color': CHOW45_MAPBOX_CONFIG.accuracyColor,
          'circle-radius': this._metersToPixels(map, lngLat.lat, accuracyMeters),
          'circle-stroke-color': CHOW45_MAPBOX_CONFIG.accuracyStroke || '#00B978',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.8
        }
      });
    }
    map.getSource('gps-accuracy').setData({
      type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] }
    });
    const updateCircle = () => {
      if (map.getLayer('gps-accuracy-circle')) {
        map.setPaintProperty('gps-accuracy-circle', 'circle-radius', this._metersToPixels(map, lngLat.lat, accuracyMeters));
      }
    };
    map.on('zoom', updateCircle);
    map.once('idle', updateCircle);
  }

  removeAccuracyCircle(map) {
    if (!map) return;
    if (map.getLayer('gps-accuracy-circle')) map.removeLayer('gps-accuracy-circle');
    if (map.getSource('gps-accuracy')) map.removeSource('gps-accuracy');
  }

  _metersToPixels(map, lat, meters) {
    const zoom = map ? map.getZoom() : 14;
    const metersPerPixel = 156543.03392 * Math.cos((lat * Math.PI) / 180) / Math.pow(2, zoom);
    return Math.max(4, meters / metersPerPixel);
  }

  // -------------------------------------------------------------
  // FORWARD & REVERSE GEOCODING (Mapbox Geocoding API)
  // -------------------------------------------------------------
  _geocodeUrl(path, params) {
    const qs = new URLSearchParams({
      access_token: this.token,
      country: 'ng',
      limit: '6',
      ...params
    });
    return `https://api.mapbox.com/geocoding/v5/${path}?${qs.toString()}`;
  }

  /**
   * Search addresses / places. Debounced + cached.
   * @returns {Promise<Array>} results [{text, placeName, lng, lat, placeId, type}]
   */
  searchAddress(query) {
    return new Promise((resolve) => {
      const q = (query || '').trim();
      if (q.length < 2) return resolve([]);

      if (this.geocodeCache.has(q)) return resolve(this.geocodeCache.get(q));

      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(async () => {
        try {
          const prox = CHOW45_MAPBOX_CONFIG.geocodeProximity;
          const url = this._geocodeUrl('mapbox.places/' + encodeURIComponent(q), {
            proximity: `${prox[0]},${prox[1]}`,
            types: 'address,poi,neighborhood,locality,place,district,region'
          });
          const res = await fetch(url);
          if (!res.ok) throw new Error('Geocoding request failed');
          const data = await res.json();
          const results = (data.features || []).map(f => ({
            text: f.text,
            placeName: f.place_name,
            lng: f.center[0],
            lat: f.center[1],
            placeId: f.id,
            type: f.place_type && f.place_type[0]
          }));
          this.geocodeCache.set(q, results);
          resolve(results);
        } catch (err) {
          console.error('Mapbox search failed:', err);
          resolve([]);
        }
      }, CHOW45_MAPBOX_CONFIG.searchDebounceMs);
    });
  }

  /**
   * Convert latitude/longitude to a structured Chow45 location object.
   * Uses Mapbox context data (not a single text format).
   */
  async reverseGeocode(lng, lat) {
    const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
    if (this.reverseCache.has(key)) return this.reverseCache.get(key);

    const fallback = {
      address: '',
      street: '',
      locality: '',
      place: '',
      lga: '',
      state: '',
      country: '',
      placeId: null,
      formattedAddress: '',
      lng,
      lat
    };

    try {
      const url = this._geocodeUrl(`mapbox.places/${lng},${lat}.json`, { limit: '1' });
      const res = await fetch(url);
      if (!res.ok) throw new Error('Reverse geocoding failed');
      const data = await res.json();
      const feature = data.features && data.features[0];
      if (!feature) {
        this.reverseCache.set(key, fallback);
        return fallback;
      }

      const lookup = (prefix) => {
        const f = (feature.context || []).find(c => c.id.startsWith(prefix));
        return f ? f.text : '';
      };

      const locality = lookup('locality');
      const place = lookup('place');
      const district = lookup('district');
      const region = lookup('region');
      const state = /state/.test(region) ? region.replace(/\s*State$/, '') : region;

      const result = {
        address: feature.text || '',
        street: feature.address ? `${feature.address} ${feature.text}`.trim() : '',
        locality: locality || '',
        place: place || '',
        lga: district || '',                       // district -> LGA where available
        state: state || region || '',
        country: lookup('country') || 'Nigeria',
        placeId: feature.id || null,
        lng,
        lat
      };
      this.reverseCache.set(key, result);
      return result;
    } catch (err) {
      console.warn('Mapbox reverse geocode failed, attempting Nominatim fallback:', err);
      // Fallback 1: OpenStreetMap Nominatim
      try {
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          const a = nomData.address || {};
          const street = a.road || a.pedestrian || a.suburb || '';
          const locality = a.neighbourhood || a.suburb || '';
          const place = a.city || a.town || a.county || '';
          const state = a.state || '';
          const country = a.country || 'Nigeria';
          const formatted = [street, locality, place, state, country].filter(Boolean).join(', ') || nomData.display_name;

          const nomResult = {
            address: street || place || 'Current Location',
            street: street,
            locality: locality,
            place: place,
            lga: a.county || place || '',
            state: state,
            country: country,
            placeId: nomData.place_id ? String(nomData.place_id) : null,
            formattedAddress: formatted,
            lng,
            lat
          };
          this.reverseCache.set(key, nomResult);
          return nomResult;
        }
      } catch (nomErr) {
        console.warn('Nominatim fallback failed:', nomErr);
      }

      this.reverseCache.set(key, fallback);
      return fallback;
    }
  }

  /**
   * Full location resolution: reverse geocode + service-zone validation.
   */
  async resolveLocation(lng, lat, opts = {}) {
    const address = await this.reverseGeocode(lng, lat);
    const availability = getServiceAvailability({ lng, lat });

    return {
      latitude: lat,
      longitude: lng,
      accuracy: opts.accuracy || null,
      timestamp: opts.timestamp || Date.now(),
      address: address.address,
      street: address.street,
      locality: address.locality,
      place: address.place,
      lga: address.lga,
      state: address.state || (availability.inOgun ? 'Ogun' : ''),
      country: address.country || 'Nigeria',
      placeId: address.placeId,
      formattedAddress: [
        address.street || address.address,
        address.locality || address.place || address.lga,
        address.state || (availability.inOgun ? 'Ogun State' : ''),
        address.country || 'Nigeria'
      ].filter(Boolean).join(', '),
      availability
    };
  }

  // -------------------------------------------------------------
  // ROUTES & DELIVERY QUOTE
  // -------------------------------------------------------------
  /**
   * Real road route via Mapbox Directions.
   * @returns {Promise<{distanceMeters:number, durationSeconds:number, geometry:object|null}|null>}
   */
  async getDirections(origin, destination) {
    try {
      const o = [origin.lng ?? origin[0], origin.lat ?? origin[1]];
      const d = [destination.lng ?? destination[0], destination.lat ?? destination[1]];
      const url = `https://api.mapbox.com/directions/v5/${CHOW45_MAPBOX_CONFIG.routeProfile}/${o[0]},${o[1]};${d[0]},${d[1]}?access_token=${this.token}&alternatives=false&geometries=geojson&overview=full&steps=false&annotations=distance,duration`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Directions request failed');
      const data = await res.json();
      const route = data.routes && data.routes[0];
      if (!route) return null;
      return {
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
        geometry: route.geometry
      };
    } catch (err) {
      console.error('Mapbox directions failed:', err);
      return null;
    }
  }

  drawRoute(containerId, geometry) {
    const map = this.getMap(containerId);
    if (!map || !map.getSource('chow45-route')) return;
    const coords = geometry && geometry.coordinates && geometry.coordinates.length ? geometry.coordinates : [];
    map.getSource('chow45-route').setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords }
    });
  }

  clearRoute(containerId) {
    const map = this.getMap(containerId);
    if (map && map.getSource('chow45-route')) {
      map.getSource('chow45-route').setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [] }
      });
    }
  }

  /**
   * Delivery quote: route distance/duration + delivery fee.
   * Prefers server-validated pricing; falls back to client config when the
   * API is unreachable (static hosting).
   */
  async getDeliveryQuote(store, deliveryLocation, opts = {}) {
    const origin = { lng: store.lng || store.longitude, lat: store.lat || store.latitude };
    const dest = { lng: deliveryLocation.longitude ?? deliveryLocation.lng, lat: deliveryLocation.latitude ?? deliveryLocation.lat };

    const clientRoute = await this.getDirections(origin, dest);
    const fallbackRoute = clientRoute || {
      distanceMeters: haversineDistanceMeters(origin, dest),
      durationSeconds: (haversineDistanceMeters(origin, dest) / 500) * 60,
      geometry: null
    };

    const config = opts.config || {};
    const zone = getServiceAvailability(dest).zone;

    // Ask the backend to validate distance + fee (authoritative when available).
    try {
      const apiRoute = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup: { lat: origin.lat, lng: origin.lng },
          dropoff: { lat: dest.lat, lng: dest.lng },
          zoneId: zone ? zone.id : null
        })
      });
      if (apiRoute.ok) {
        const server = await apiRoute.json();
        return buildDeliveryQuote(
          server.distanceMeters ?? fallbackRoute.distanceMeters,
          server.durationSeconds ?? fallbackRoute.durationSeconds,
          zone,
          config
        );
      }
    } catch (err) {
      console.warn('Delivery quote API unavailable, using client engine.', err);
    }

    return buildDeliveryQuote(fallbackRoute.distanceMeters, fallbackRoute.durationSeconds, zone, config);
  }

  // -------------------------------------------------------------
  // DELIVERY MISSION (Live Tracking)
  // -------------------------------------------------------------
  async renderDeliveryMission(order, store, customerLocation) {
    this.clearMarkers();
    const containerId = 'mapbox-canvas';
    const custCoord = [customerLocation.lng ?? (customerLocation.longitude ?? 3.6545), customerLocation.lat ?? (customerLocation.latitude ?? 6.8482)];
    const storeCoord = [store.lng || store.longitude || 3.6530, store.lat || store.latitude || 6.8475];

    const map = await this.initMap(containerId, { initCenter: custCoord, zoom: 13.5 });
    if (!map) return;

    const state = window.chowStore.state;
    const rider = (state.riders && state.riders[0]) || { name: 'Chow45 Rider', currentLat: storeCoord[1], currentLng: storeCoord[0] };
    const riderCoord = [rider.currentLng ?? (storeCoord[0] + custCoord[0]) / 2, rider.currentLat ?? (storeCoord[1] + custCoord[1]) / 2];

    map.flyTo({ center: custCoord, zoom: 13.5, duration: 400 });

    if (map.getSource('chow45-route')) {
      this.clearRoute(containerId);
    } else if (typeof map.on === 'function') {
      map.on('load', () => this.clearRoute(containerId));
    }

    const storeEl = this._pinElement('store');
    storeEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
    this.pixelMarkers.store = new mapboxgl.Marker(storeEl)
      .setLngLat(storeCoord)
      .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`<strong>${store.name || 'Pickup Spot'}</strong><br><small>Restaurant</small>`))
      .addTo(map);

    const custEl = this._pinElement('customer');
    custEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    this.pixelMarkers.customer = new mapboxgl.Marker(custEl)
      .setLngLat(custCoord)
      .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`<strong>Delivery Point</strong><br><small>${order.deliveryAddress || 'Home'}</small>`))
      .addTo(map);

    const riderEl = this._pinElement('rider');
    riderEl.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M15 6h-5l-3 6.5h6l3-6.5z"/><path d="M19 17.5l-4-7.5h-5"/></svg>`;
    this.pixelMarkers.rider = new mapboxgl.Marker(riderEl)
      .setLngLat(riderCoord)
      .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`<strong>${order.riderName || rider.name}</strong><br><small>Chow45 Express Dispatch</small>`))
      .addTo(map);

    // Real route when possible, otherwise straight-line fallback
    const route = await this.getDirections(storeCoord, custCoord);
    if (route && route.geometry) {
      this.drawRoute(containerId, route.geometry);
    } else {
      this.drawRoute(containerId, {
        coordinates: [storeCoord, [(storeCoord[0] + custCoord[0]) / 2 + 0.001, (storeCoord[1] + custCoord[1]) / 2], custCoord]
      });
    }

    this.featuredCoordinates = { storeCoord, custCoord, riderCoord };
    this.fitBounds(containerId, [storeCoord, custCoord, riderCoord], 80);
    this.startRiderSimulation(order.status, riderCoord, storeCoord, custCoord);
  }

  startRiderSimulation(status, riderCoord, storeCoord, custCoord) {
    if (this.routeAnimationTimer) clearInterval(this.routeAnimationTimer);

    if (status === 'DELIVERED') {
      if (this.pixelMarkers.rider) this.pixelMarkers.rider.setLngLat(custCoord);
      return;
    }

    const headingToCustomer = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'RIDER_NEARBY'].includes(status);
    const start = headingToCustomer ? storeCoord : riderCoord;
    const end = headingToCustomer ? custCoord : storeCoord;

    if (!this.pixelMarkers.rider) return;
    this.pixelMarkers.rider.setLngLat(start);

    let progress = 0;
    this.routeAnimationTimer = setInterval(() => {
      if (!this.pixelMarkers.rider) { clearInterval(this.routeAnimationTimer); return; }
      progress += 0.025;
      if (progress > 1) progress = 0;
      this.pixelMarkers.rider.setLngLat([
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress
      ]);
    }, 400);
  }

  // -------------------------------------------------------------
  // ZONE POLYGON EDITOR (Admin Service Areas)
  // -------------------------------------------------------------
  /**
   * Render draggable vertex markers for a zone polygon on the admin map.
   * @returns {Array<mapboxgl.Marker>} vertex markers
   */
  renderZonePolygonEditor(containerId, zone, onChange) {
    const map = this.getMap(containerId);
    if (!map) return [];

    this._removePixelMarkers();
    this.clearRoute(containerId);

    const vertexMarkers = (zone.polygon || []).map((coord, idx) => {
      const el = this._pinElement('vertex');
      el.innerHTML = `<span style="font-weight:800;font-size:12px;">${idx + 1}</span>`;
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat(coord)
        .addTo(map);
      marker.on('drag', () => {
        const c = marker.getLngLat();
        zone.polygon[idx] = [c.lng, c.lat];
        if (onChange) onChange(zone);
      });
      return marker;
    });

    this.pixelMarkers.zoneVertices = vertexMarkers;
    return vertexMarkers;
  }

  drawZonePolygon(map, polygon, color = '#0C513F') {
    if (!map) return;
    if (!map.isStyleLoaded()) {
      map.once('style.load', () => this.drawZonePolygon(map, polygon, color));
      return;
    }
    if (!map.getSource('zone-editor')) {
      map.addSource('zone-editor', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } }
      });
      map.addLayer({
        id: 'zone-editor-fill', type: 'fill', source: 'zone-editor',
        paint: { 'fill-color': CHOW45_MAPBOX_CONFIG.zoneFillColor, 'fill-opacity': 0.18 }
      });
      map.addLayer({
        id: 'zone-editor-line', type: 'line', source: 'zone-editor',
        paint: { 'line-color': color, 'line-width': 3 }
      });
    }
    if (map.getSource('zone-editor')) {
      map.getSource('zone-editor').setData({
        type: 'Feature', properties: {},
        geometry: { type: 'Polygon', coordinates: [polygon] }
      });
    }
  }

  // -------------------------------------------------------------
  // CLEANUP & HOUSEKEEPING
  // -------------------------------------------------------------
  clearMarkers() {
    this._removePixelMarkers();
    if (this.routeAnimationTimer) clearInterval(this.routeAnimationTimer);
  }

  removeMap(containerId) {
    const map = this.getMap(containerId);
    if (map) {
      map.remove();
      delete this.maps[containerId];
    }
  }
}

window.chowMap = new MapboxService();