/**
 * CHOW45 GOOGLE MAPS PLATFORM SERVICE
 * Location, geocoding, route, delivery-quote, and live tracking for Chow45.
 *
 * Implements Google Maps JavaScript API with full backward-compatibility for
 * existing Chow45 controllers (Customer, Vendor, Rider, Admin, LocationPicker).
 *
 * Attribution: internalUsageAttributionIds: ['gmp_git_agentskills_v1']
 */

class GoogleMapsService {
  constructor() {
    this.maps = {};             // containerId -> google.maps.Map instance
    this.markers = {};          // logical marker refs
    this.pixelMarkers = {};     // raw marker refs for cleanup
    this.routePolylines = {};   // containerId -> { casing, line }
    this.zonePolygons = {};     // containerId -> [google.maps.Polygon]
    this.accuracyCircles = {};  // mapInstance -> google.maps.Circle
    this.routeAnimationTimer = null;
    this.geocodeCache = new Map();
    this.reverseCache = new Map();
    this.searchDebounceTimer = null;
    this.moveDebounceTimer = null;
    this.onMoveSettled = null;
    this.isLoaded = false;
    this.key = (window.CHOW45_MAP_CONFIG && window.CHOW45_MAP_CONFIG.key)
      || window.__CHOW45_GOOGLE_MAPS_KEY__
      || 'AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo';
  }

  // -------------------------------------------------------------
  // STATUS & LOADER
  // -------------------------------------------------------------
  isReady() {
    return Boolean(this.key && typeof window.google !== 'undefined' && typeof window.google.maps !== 'undefined' && (typeof window.google.maps.Map === 'function' || this.MapClass));
  }

  async loadLib() {
    if (this._libPromise) return this._libPromise;

    this._libPromise = (async () => {
      // 1. Ensure Google Maps base script is loaded
      await new Promise((resolve) => {
        if (typeof window.google !== 'undefined' && window.google.maps) {
          return resolve(true);
        }

        const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        if (existingScript) {
          if (existingScript.getAttribute('data-chow45-loaded') === 'true' || (window.google && window.google.maps)) {
            return resolve(true);
          }
          existingScript.addEventListener('load', () => resolve(true), { once: true });
          existingScript.addEventListener('error', () => resolve(false), { once: true });
          setTimeout(() => resolve(true), 2500);
          return;
        }

        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(this.key)}&libraries=places,geometry,marker&loading=async&v=weekly`;
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = (err) => {
          console.error('Failed to load Google Maps JavaScript API:', err);
          resolve(false);
        };
        document.head.appendChild(s);
      });

      // 2. Poll until window.google.maps and importLibrary (or Map) are ready
      let attempts = 0;
      while (
        (typeof window.google === 'undefined' ||
          !window.google.maps ||
          (typeof window.google.maps.Map !== 'function' && typeof window.google.maps.importLibrary !== 'function')) &&
        attempts < 80
      ) {
        await new Promise((r) => setTimeout(r, 50));
        attempts++;
      }

      // 3. Dynamic Library Import if importLibrary is present
      if (window.google && window.google.maps && typeof window.google.maps.importLibrary === 'function') {
        try {
          const [mapsLib, markerLib] = await Promise.all([
            window.google.maps.importLibrary('maps'),
            window.google.maps.importLibrary('marker').catch(() => null)
          ]);

          if (mapsLib) {
            Object.assign(window.google.maps, mapsLib);
            this.MapClass = mapsLib.Map;
            this.PolygonClass = mapsLib.Polygon;
            this.PolylineClass = mapsLib.Polyline;
            this.CircleClass = mapsLib.Circle;
            this.LatLngBoundsClass = mapsLib.LatLngBounds;
            this.LatLngClass = mapsLib.LatLng;
          }
          if (markerLib) {
            Object.assign(window.google.maps, markerLib);
            window.google.maps.marker = window.google.maps.marker || {};
            if (markerLib.AdvancedMarkerElement) {
              window.google.maps.marker.AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
              window.google.maps.marker.PinElement = markerLib.PinElement;
            }
          }
        } catch (e) {
          console.warn('[GoogleMapsService] importLibrary error:', e);
        }
      }

      this.isLoaded = Boolean(window.google && window.google.maps && (typeof window.google.maps.Map === 'function' || this.MapClass));
      return this.isLoaded;
    })();

    return this._libPromise;
  }

  // -------------------------------------------------------------
  // MAP INITIALIZATION (cached per container)
  // -------------------------------------------------------------
  async initMap(containerId = 'mapbox-canvas', opts = {}) {
    await this.loadLib();
    if (typeof window.google === 'undefined' || !window.google.maps) {
      console.error('Google Maps Platform failed to load.');
      return null;
    }

    let MapConstructor = (window.google.maps && window.google.maps.Map) || this.MapClass;
    if (typeof MapConstructor !== 'function') {
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 100));
        MapConstructor = (window.google.maps && window.google.maps.Map) || this.MapClass;
        if (typeof MapConstructor === 'function') break;
      }
    }

    if (typeof MapConstructor !== 'function') {
      console.error('Google Maps Map constructor is not available.');
      return null;
    }

    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!container) {
      console.warn('Map container element not found:', containerId);
      return null;
    }

    // Reuse existing cached map instance
    if (this.maps[containerId]) {
      const existing = this.maps[containerId];
      if (opts.onLoad) opts.onLoad(existing);
      return existing;
    }

    // Parse center
    const rawCenter = opts.center || opts.initialCenter || opts.initCenter || [3.6545, 6.8482];
    const center = Array.isArray(rawCenter)
      ? { lat: rawCenter[1], lng: rawCenter[0] }
      : { lat: rawCenter.lat ?? 6.8482, lng: rawCenter.lng ?? 3.6545 };

    try {
      const map = new MapConstructor(container, {
        center,
        zoom: opts.zoom || 14.5,
        mapId: 'DEMO_MAP_ID', // Enables AdvancedMarkerElement
        internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy'
      });

      // Provide mapbox-like helper methods for compatibility
      map.isStyleLoaded = () => true;
      map.loaded = () => true;
      map.once = (eventName, handler) => {
        const listener = window.google.maps.event.addListenerOnce(map, eventName === 'load' || eventName === 'style.load' ? 'idle' : eventName, handler);
        return listener;
      };
      map.off = (eventName, handler) => {
        // google maps uses removeListener
      };
      map.resize = () => {
        window.google.maps.event.trigger(map, 'resize');
      };

      // Mapbox GL JS compatibility stubs (getSource, addSource, addLayer, etc.)
      const mockSources = {};
      const mockLayers = {};
      map.getSource = (id) => mockSources[id] || null;
      map.addSource = (id, source) => {
        mockSources[id] = {
          ...source,
          setData: (data) => {
            mockSources[id].data = data;
          }
        };
        return mockSources[id];
      };
      map.getLayer = (id) => mockLayers[id] || null;
      map.addLayer = (layer) => {
        mockLayers[layer.id] = layer;
        return layer;
      };
      map.removeLayer = (id) => {
        delete mockLayers[id];
      };
      map.removeSource = (id) => {
        delete mockSources[id];
      };
      map.setLayoutProperty = () => {};
      map.setPaintProperty = () => {};

      // Pin drag animation and movement listeners
      map.addListener('dragstart', () => {
        const pin = document.getElementById('picker-center-pin');
        if (pin) pin.classList.add('dragging');
      });
      map.addListener('dragend', () => {
        const pin = document.getElementById('picker-center-pin');
        if (pin) pin.classList.remove('dragging');
      });

      // Settled movement listener
      map.addListener('idle', () => this._onMapSettled(map, opts));

      window.google.maps.event.addListenerOnce(map, 'idle', () => {
        this.resize();
        if (opts.onLoad) opts.onLoad(map);
      });

      // Automatically handle container resizing (modal animations, responsive viewport changes)
      if (typeof ResizeObserver !== 'undefined' && container) {
        let resizeTimer = null;
        const ro = new ResizeObserver(() => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            if (map && window.google && window.google.maps) {
              const c = map.getCenter();
              window.google.maps.event.trigger(map, 'resize');
              if (c) map.setCenter(c);
            }
          }, 60);
        });
        ro.observe(container);
        map._resizeObserver = ro;
      }

      this.maps[containerId] = map;
      return map;
    } catch (e) {
      console.error('Error initializing Google Map:', e);
      return null;
    }
  }

  getMap(containerId) {
    return this.maps[containerId] || null;
  }

  _onMapSettled(map, opts) {
    clearTimeout(this.moveDebounceTimer);
    const cb = this.onMoveSettled || (opts && opts.onMoveSettled);
    if (!cb) return;
    const cfg = window.CHOW45_MAP_CONFIG || {};
    this.moveDebounceTimer = setTimeout(() => {
      const c = map.getCenter();
      if (c) {
        const lng = typeof c.lng === 'function' ? c.lng() : c.lng;
        const lat = typeof c.lat === 'function' ? c.lat() : c.lat;
        cb({ lng: Number(lng) || 3.6545, lat: Number(lat) || 6.8482 });
      }
    }, cfg.moveSettleMs || 400);
  }

  getCenter(containerId) {
    const map = this.getMap(containerId);
    if (!map) return null;
    const c = map.getCenter();
    if (!c) return null;
    const lng = typeof c.lng === 'function' ? c.lng() : (c.lng ?? (Array.isArray(c) ? c[0] : c.longitude));
    const lat = typeof c.lat === 'function' ? c.lat() : (c.lat ?? (Array.isArray(c) ? c[1] : c.latitude));
    const numLng = Number(lng) || 3.6545;
    const numLat = Number(lat) || 6.8482;
    const res = [numLng, numLat];
    res.lng = numLng;
    res.lat = numLat;
    res.longitude = numLng;
    res.latitude = numLat;
    return res;
  }

  flyTo(containerId, lng, lat, zoom = 15) {
    const map = this.getMap(containerId);
    if (map) {
      map.panTo({ lat, lng });
      if (zoom) map.setZoom(zoom);
    }
  }

  fitBounds(containerId, coords, padding = 80) {
    const map = this.getMap(containerId);
    if (!map || !coords || !coords.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    coords.forEach((c) => {
      if (Array.isArray(c)) {
        bounds.extend({ lat: c[1], lng: c[0] });
      } else if (c && typeof c.lat === 'number') {
        bounds.extend({ lat: c.lat, lng: c.lng });
      } else if (c && typeof c.latitude === 'number') {
        bounds.extend({ lat: c.latitude, lng: c.longitude });
      }
    });
    map.fitBounds(bounds, padding);
  }

  resize() {
    Object.keys(this.maps).forEach((id) => {
      setTimeout(() => {
        const m = this.maps[id];
        if (m && window.google && window.google.maps) {
          const c = m.getCenter();
          window.google.maps.event.trigger(m, 'resize');
          if (c) m.setCenter(c);
        }
      }, 80);
    });
  }

  // -------------------------------------------------------------
  // SERVICE ZONES POLYGONS
  // -------------------------------------------------------------
  renderServiceZones(containerId) {
    const map = this.getMap(containerId);
    if (!map) return;

    // Clear any existing polygons for this container
    if (this.zonePolygons[containerId]) {
      this.zonePolygons[containerId].forEach((poly) => poly.setMap(null));
    }
    this.zonePolygons[containerId] = [];

    const zones = (window.CHOW45_SERVICE_ZONES || []).filter((z) => z.polygon && z.polygon.length);
    const cfg = window.CHOW45_MAP_CONFIG || {};

    zones.forEach((zone) => {
      const paths = zone.polygon.map((p) => ({ lat: p[1], lng: p[0] }));
      const polygon = new window.google.maps.Polygon({
        paths,
        strokeColor: zone.active ? (cfg.zoneLineColor || '#0C513F') : '#9CA3AF',
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: zone.active ? (cfg.zoneFillColor || '#00B978') : '#9CA3AF',
        fillOpacity: cfg.zoneFillOpacity || 0.14,
        map
      });
      this.zonePolygons[containerId].push(polygon);
    });
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

  addMarker(map, type, lngLat, opts = {}) {
    if (!map || !window.google || !window.google.maps) return null;

    const lat = lngLat.lat ?? lngLat[1] ?? (lngLat.latitude ?? 6.8482);
    const lng = lngLat.lng ?? lngLat[0] ?? (lngLat.longitude ?? 3.6545);
    const pos = { lat, lng };

    const el = this._pinElement(type);
    if (opts.svg) el.innerHTML = opts.svg;

    let marker;
    if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
      marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        content: el,
        title: opts.title || ''
      });
      // Compatibility helper
      marker.setLngLat = (coords) => {
        const nLat = coords.lat ?? coords[1];
        const nLng = coords.lng ?? coords[0];
        marker.position = { lat: nLat, lng: nLng };
        return marker;
      };
      marker.remove = () => {
        marker.map = null;
      };
    } else {
      marker = new window.google.maps.Marker({
        map,
        position: pos,
        title: opts.title || '',
        draggable: !!opts.draggable
      });
      marker.setLngLat = (coords) => {
        const nLat = coords.lat ?? coords[1];
        const nLng = coords.lng ?? coords[0];
        marker.setPosition({ lat: nLat, lng: nLng });
        return marker;
      };
      marker.remove = () => {
        marker.setMap(null);
      };
    }

    if (opts.popupHtml) {
      const info = new window.google.maps.InfoWindow({ content: opts.popupHtml });
      if (typeof marker.addEventListener === 'function') {
        marker.addEventListener('gmp-click', () => info.open({ anchor: marker, map }));
      } else if (typeof marker.addListener === 'function') {
        marker.addListener('click', () => info.open({ anchor: marker, map }));
      }
      marker.infoWindow = info;
    }

    return marker;
  }

  _removePixelMarkers() {
    Object.keys(this.pixelMarkers).forEach((k) => {
      try {
        const m = this.pixelMarkers[k];
        if (Array.isArray(m)) {
          m.forEach((subM) => {
            if (subM.remove) subM.remove();
            else if (subM.setMap) subM.setMap(null);
            else subM.map = null;
          });
        } else if (m) {
          if (m.remove) m.remove();
          else if (m.setMap) m.setMap(null);
          else m.map = null;
        }
      } catch (e) {}
    });
    this.pixelMarkers = {};
  }

  showAccuracyCircle(map, lngLat, accuracyMeters) {
    if (!map || !window.google || !window.google.maps || !accuracyMeters || accuracyMeters <= 0) return;
    const lat = lngLat.lat ?? lngLat[1] ?? lngLat.latitude;
    const lng = lngLat.lng ?? lngLat[0] ?? lngLat.longitude;
    const center = { lat, lng };

    const cfg = window.CHOW45_MAP_CONFIG || {};

    if (!this.accuracyCircles[map]) {
      this.accuracyCircles[map] = new window.google.maps.Circle({
        strokeColor: cfg.accuracyStroke || '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: cfg.accuracyColor || 'rgba(66, 133, 244, 0.18)',
        fillOpacity: 0.35,
        map,
        center,
        radius: accuracyMeters
      });
    } else {
      this.accuracyCircles[map].setCenter(center);
      this.accuracyCircles[map].setRadius(accuracyMeters);
      this.accuracyCircles[map].setMap(map);
    }
  }

  removeAccuracyCircle(map) {
    if (!map) return;
    if (this.accuracyCircles[map]) {
      this.accuracyCircles[map].setMap(null);
      delete this.accuracyCircles[map];
    }
  }

  // -------------------------------------------------------------
  // FORWARD & REVERSE GEOCODING (Google Maps Platform)
  // -------------------------------------------------------------
  searchAddress(query) {
    return new Promise((resolve) => {
      const q = (query || '').trim();
      if (q.length < 2) return resolve([]);
      if (this.geocodeCache.has(q)) return resolve(this.geocodeCache.get(q));

      const localPlaces = [
        {
          text: 'Moboluwaduro CDA',
          placeName: '45 Lagos-Abeokuta Expy, Moboluwaduro CDA, Ifo 112105, Ogun State, Nigeria',
          lng: 3.1975,
          lat: 6.8111,
          placeId: 'loc-ifo-moboluwaduro',
          type: 'neighborhood'
        },
        {
          text: 'Ifo Town Center / Expressway',
          placeName: 'Lagos-Abeokuta Expressway, Ifo, Ogun State, Nigeria',
          lng: 3.1950,
          lat: 6.8140,
          placeId: 'loc-ifo-town',
          type: 'route'
        },
        {
          text: 'Ibogun Campus (OGITECH / OOU)',
          placeName: 'Ibogun Campus, Ifo LGA, Ogun State, Nigeria',
          lng: 3.3900,
          lat: 6.7200,
          placeId: 'loc-ibogun-campus',
          type: 'campus'
        },
        {
          text: 'OOUTH / Sagamu Campus',
          placeName: 'OOUTH, Hospital Road, Sagamu, Ogun State, Nigeria',
          lng: 3.6139,
          lat: 6.8270,
          placeId: 'loc-sagamu-oouth',
          type: 'hospital'
        },
        {
          text: 'OOU Main Campus Gate',
          placeName: 'OOU Main Campus Gate, Ago-Iwoye, Ogun State, Nigeria',
          lng: 3.6545,
          lat: 6.8482,
          placeId: 'loc-oou-main-campus',
          type: 'campus'
        }
      ];

      const qLower = q.toLowerCase();
      const matchedLocal = localPlaces.filter(p =>
        p.text.toLowerCase().includes(qLower) ||
        p.placeName.toLowerCase().includes(qLower)
      );

      clearTimeout(this.searchDebounceTimer);
      const cfg = window.CHOW45_MAP_CONFIG || {};
      this.searchDebounceTimer = setTimeout(async () => {
        try {
          // 1. Primary: Server-side Google Places API (New) Autocomplete
          const autoRes = await fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(q)}`);
          if (autoRes.ok) {
            const autoData = await autoRes.json();
            if (Array.isArray(autoData.results) && autoData.results.length > 0) {
              const mapped = autoData.results.map((r) => ({
                text: r.text || r.placeName.split(',')[0],
                placeName: r.placeName,
                placeId: r.placeId,
                lng: r.lng,
                lat: r.lat,
                type: r.type || 'street'
              }));
              const combined = [...matchedLocal, ...mapped.filter(m => !matchedLocal.some(lp => lp.text.toLowerCase() === m.text.toLowerCase()))];
              this.geocodeCache.set(q, combined);
              return resolve(combined);
            }
          }

          // 2. Client-side Geocoder fallback
          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode(
              {
                address: q,
                componentRestrictions: { country: 'NG' }
              },
              (results, status) => {
                if (status === 'OK' && results && results.length) {
                  const mapped = results.slice(0, 6).map((r) => ({
                    text: r.formatted_address.split(',')[0],
                    placeName: r.formatted_address,
                    lng: r.geometry.location.lng(),
                    lat: r.geometry.location.lat(),
                    placeId: r.place_id,
                    type: (r.types && r.types[0]) || 'address'
                  }));
                  const combined = [...matchedLocal, ...mapped.filter(m => !matchedLocal.some(lp => lp.text === m.text))];
                  this.geocodeCache.set(q, combined);
                  return resolve(combined);
                }
                this._fallbackSearchAddress(q).then((fb) => {
                  const combined = [...matchedLocal, ...fb];
                  resolve(combined);
                });
              }
            );
          } else {
            this._fallbackSearchAddress(q).then((fb) => {
              const combined = [...matchedLocal, ...fb];
              resolve(combined);
            });
          }
        } catch (err) {
          console.error('Google Maps address search error:', err);
          this._fallbackSearchAddress(q).then((fb) => {
            const combined = [...matchedLocal, ...fb];
            resolve(combined);
          });
        }
      }, cfg.searchDebounceMs || 250);
    });
  }

  async getPlaceDetails(placeId) {
    if (!placeId) return null;
    try {
      const res = await fetch(`/api/geocode/details?placeId=${encodeURIComponent(placeId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[GoogleMapsService] getPlaceDetails error:', e);
    }
    return null;
  }

  async _fallbackSearchAddress(q) {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=ng&limit=6`;
      const res = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const results = (data || []).map((f) => ({
          text: f.name || f.display_name.split(',')[0],
          placeName: f.display_name,
          lng: parseFloat(f.lon),
          lat: parseFloat(f.lat),
          placeId: String(f.place_id),
          type: f.type || 'place'
        }));
        this.geocodeCache.set(q, results);
        return results;
      }
    } catch (e) {}
    return [];
  }

  /**
   * Reverse Geocode (Lat/Lng -> Structured Location)
   */
  async reverseGeocode(lng, lat) {
    const numLng = Number(typeof lng === 'function' ? lng() : lng);
    const numLat = Number(typeof lat === 'function' ? lat() : lat);
    const validLng = Number.isFinite(numLng) ? numLng : 3.6545;
    const validLat = Number.isFinite(numLat) ? numLat : 6.8482;
    const key = `${validLng.toFixed(4)},${validLat.toFixed(4)}`;
    if (this.reverseCache.has(key)) return this.reverseCache.get(key);

    const availability = typeof getServiceAvailability === 'function'
      ? getServiceAvailability({ lng: validLng, lat: validLat })
      : { status: 'available', inOgun: true, isSupported: true, zone: null };
    const zoneName = availability && availability.zone ? availability.zone.name : null;
    const fallbackTitle = zoneName
      ? zoneName
      : `Location near (${validLat.toFixed(4)}, ${validLng.toFixed(4)})`;

    const fallback = {
      address: fallbackTitle,
      street: fallbackTitle,
      locality: zoneName || (availability.inOgun ? 'Ogun' : ''),
      place: zoneName || (availability.inOgun ? 'Ogun' : ''),
      lga: availability && availability.zone ? availability.zone.lga : (availability.inOgun ? 'Ogun State' : ''),
      state: availability.inOgun ? 'Ogun' : '',
      country: 'Nigeria',
      placeId: null,
      formattedAddress: `${fallbackTitle}${availability.inOgun ? ', Ogun State' : ''}, Nigeria`,
      lng: validLng,
      lat: validLat
    };

    const isPlusCode = (s) => /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(\b|$)/i.test((s || '').trim());
    const cleanAddressStr = (s) => {
      if (!s) return '';
      return s.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(?:,\s*|\s+)?/i, '')
              .replace(/^\d{5,6}(?:,\s*|\s+)?/, '')
              .trim();
    };

    // 1. First priority: Server-side route with Google Maps Geocoding API
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${validLat}&lng=${validLng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.address && !data.address.startsWith('Location near')) {
          const cleanAddr = cleanAddressStr(data.address) || data.address;
          const detectedLocality = data.locality || (cleanAddr.includes('Ifo') ? 'Ifo' : (cleanAddr.includes('Sagamu') ? 'Sagamu' : (cleanAddr.includes('Ago-Iwoye') ? 'Ago-Iwoye' : '')));
          const detectedLga = data.lga || (cleanAddr.includes('Ifo') ? 'Ifo LGA' : (cleanAddr.includes('Sagamu') ? 'Sagamu LGA' : (cleanAddr.includes('Ago-Iwoye') ? 'Ijebu North LGA' : '')));
          const detectedState = data.state || 'Ogun';

          let streetCandidate = data.street;
          if (!streetCandidate || isPlusCode(streetCandidate) || /^unnamed\s+road$/i.test(streetCandidate.trim())) {
            const firstToken = cleanAddr.split(',')[0].trim();
            streetCandidate = (!isPlusCode(firstToken) && !/^\d{5,6}$/.test(firstToken) && !/^unnamed\s+road$/i.test(firstToken))
              ? firstToken
              : (detectedLocality || 'Campus Location');
          }

          const result = {
            address: streetCandidate,
            street: streetCandidate,
            locality: detectedLocality || 'Ogun',
            place: data.place || detectedLocality || 'Ogun',
            lga: detectedLga || 'Ogun State',
            state: detectedState,
            country: data.country || 'Nigeria',
            placeId: null,
            formattedAddress: cleanAddr,
            lng: validLng,
            lat: validLat
          };
          this.reverseCache.set(key, result);
          return result;
        }
      }
    } catch (e) {
      console.warn('[GoogleMapsService] Server reverse geocode error:', e);
    }

    // 2. Client-side Google Maps Geocoder
    if (window.google && window.google.maps) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const clientResult = await new Promise((resolve) => {
          geocoder.geocode({ location: { lat: validLat, lng: validLng } }, (results, status) => {
            if (status === 'OK' && Array.isArray(results) && results.length > 0) {
              const r = results.find(item => item.types && !item.types.includes('plus_code') && !isPlusCode(item.formatted_address)) || results[0];
              const getComp = (types) => {
                const c = (r.address_components || []).find((comp) =>
                  types.some((t) => comp.types.includes(t))
                );
                return c ? c.long_name : '';
              };

              const streetNumber = getComp(['street_number']);
              let route = getComp(['route']);
              if (/^unnamed\s+road$/i.test((route || '').trim())) route = '';

              const sublocality = getComp(['sublocality_level_1', 'sublocality', 'neighborhood', 'point_of_interest', 'administrative_area_level_3']);
              const locality = getComp(['locality', 'sublocality_level_1', 'sublocality']);
              const place = getComp(['neighborhood', 'sublocality']);
              const lga = getComp(['administrative_area_level_2']);
              let state = getComp(['administrative_area_level_1']);
              if (state) state = state.replace(/\s*State$/i, '');
              const country = getComp(['country']) || 'Nigeria';

              const cleanFormatted = cleanAddressStr(r.formatted_address) || r.formatted_address;
              let street = [streetNumber, route].filter(Boolean).join(' ') || sublocality || locality;
              if (!street || isPlusCode(street) || /^unnamed\s+road$/i.test(street.trim())) {
                const firstPart = cleanFormatted.split(',')[0].trim();
                street = (!isPlusCode(firstPart) && !/^\d{5,6}$/.test(firstPart) && !/^unnamed\s+road$/i.test(firstPart))
                  ? firstPart
                  : (locality || 'Campus Location');
              }

              const resObj = {
                address: street || cleanFormatted.split(',')[0] || locality || 'Current Location',
                street: street || cleanFormatted.split(',')[0] || locality || 'Current Location',
                locality: locality || '',
                place: place || locality || '',
                lga: lga || '',
                state: state || 'Ogun',
                country: country || 'Nigeria',
                placeId: r.place_id || null,
                formattedAddress: cleanFormatted,
                lng: validLng,
                lat: validLat
              };
              resolve(resObj);
            } else {
              resolve(null);
            }
          });
        });

        if (clientResult) {
          this.reverseCache.set(key, clientResult);
          return clientResult;
        }
      } catch (err) {
        console.warn('Google client reverse geocode error:', err);
      }
    }

    // 3. Fallback to OpenStreetMap Nominatim
    try {
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${validLat}&lon=${validLng}`, {
        headers: { Accept: 'application/json' }
      });
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const a = nomData.address || {};
        const street = a.road || a.pedestrian || a.suburb || '';
        const locality = a.neighbourhood || a.suburb || '';
        const place = a.city || a.town || a.county || '';
        const state = (a.state || '').replace(/\s*State$/i, '') || 'Ogun';
        const country = a.country || 'Nigeria';
        const formatted = [street, locality, place, state, country].filter(Boolean).join(', ') || nomData.display_name;

        const nomResult = {
          address: street || place || fallbackTitle,
          street: street || fallbackTitle,
          locality,
          place,
          lga: a.county || place || (availability && availability.zone ? availability.zone.lga : 'Ogun State'),
          state,
          country,
          placeId: nomData.place_id ? String(nomData.place_id) : null,
          formattedAddress: formatted,
          lng: validLng,
          lat: validLat
        };
        this.reverseCache.set(key, nomResult);
        return nomResult;
      }
    } catch (nomErr) {}

    this.reverseCache.set(key, fallback);
    return fallback;
  }

  async resolveLocation(lng, lat, opts = {}) {
    const numLng = Number(typeof lng === 'function' ? lng() : lng);
    const numLat = Number(typeof lat === 'function' ? lat() : lat);
    const validLng = Number.isFinite(numLng) ? numLng : 3.6545;
    const validLat = Number.isFinite(numLat) ? numLat : 6.8482;
    const address = await this.reverseGeocode(validLng, validLat);
    const availability = typeof getServiceAvailability === 'function'
      ? getServiceAvailability({ lng: validLng, lat: validLat })
      : { status: 'available', inOgun: true, isSupported: true, zone: null };

    const defaultStreet = (availability && availability.zone) ? availability.zone.name : `Pinned Location (${validLat.toFixed(4)}, ${validLng.toFixed(4)})`;
    const resolvedAddress = address.address || address.street || defaultStreet;
    const resolvedStreet = address.street || address.address || defaultStreet;
    const resolvedLocality = address.locality || (availability.zone ? availability.zone.lga.replace(' LGA', '') : (address.formattedAddress && address.formattedAddress.includes('Ifo') ? 'Ifo' : (availability.inOgun ? 'Ogun' : '')));
    const resolvedLga = address.lga || (availability.zone ? availability.zone.lga : (address.formattedAddress && address.formattedAddress.includes('Ifo') ? 'Ifo LGA' : (availability.inOgun ? 'Ogun State' : '')));

    return {
      latitude: validLat,
      longitude: validLng,
      accuracy: opts.accuracy || null,
      timestamp: opts.timestamp || Date.now(),
      address: resolvedAddress,
      street: resolvedStreet,
      locality: resolvedLocality,
      place: address.place || resolvedLocality || (availability.zone ? availability.zone.name : 'Ogun'),
      lga: resolvedLga,
      state: address.state || (availability.inOgun ? 'Ogun' : ''),
      country: address.country || 'Nigeria',
      placeId: address.placeId,
      formattedAddress: address.formattedAddress || [
        resolvedStreet,
        resolvedLocality,
        address.state || 'Ogun State',
        address.country || 'Nigeria'
      ].filter(Boolean).join(', '),
      availability
    };
  }

  // -------------------------------------------------------------
  // ROUTES & DIRECTIONS (Google Maps Directions)
  // -------------------------------------------------------------
  async getDirections(origin, destination) {
    const o = {
      lat: origin.lat ?? origin[1] ?? origin.latitude,
      lng: origin.lng ?? origin[0] ?? origin.longitude
    };
    const d = {
      lat: destination.lat ?? destination[1] ?? destination.latitude,
      lng: destination.lng ?? destination[0] ?? destination.longitude
    };

    if (window.google && window.google.maps) {
      try {
        const directionsService = new window.google.maps.DirectionsService();
        const result = await new Promise((resolve) => {
          directionsService.route(
            {
              origin: o,
              destination: d,
              travelMode: window.google.maps.TravelMode.DRIVING
            },
            (response, status) => {
              if (status === 'OK' && response.routes && response.routes[0]) {
                const leg = response.routes[0].legs[0];
                const coordinates = response.routes[0].overview_path.map((p) => [p.lng(), p.lat()]);
                resolve({
                  distanceMeters: leg.distance.value,
                  durationSeconds: leg.duration.value,
                  geometry: { coordinates }
                });
              } else {
                resolve(null);
              }
            }
          );
        });

        if (result) return result;
      } catch (err) {
        console.warn('Google Maps DirectionsService error:', err);
      }
    }

    // Direct Haversine Fallback
    const haversineDist = typeof haversineDistanceMeters === 'function'
      ? haversineDistanceMeters(o, d)
      : Math.round(Math.hypot((o.lat - d.lat) * 111000, (o.lng - d.lng) * 111000));

    return {
      distanceMeters: haversineDist,
      durationSeconds: Math.round((haversineDist / 500) * 60),
      geometry: {
        coordinates: [
          [o.lng, o.lat],
          [(o.lng + d.lng) / 2, (o.lat + d.lat) / 2],
          [d.lng, d.lat]
        ]
      }
    };
  }

  drawRoute(containerId, geometry) {
    const map = this.getMap(containerId);
    if (!map || !window.google || !window.google.maps) return;

    this.clearRoute(containerId);

    const coords = (geometry && geometry.coordinates) || [];
    if (!coords.length) return;

    const path = coords.map((c) => ({ lat: c[1], lng: c[0] }));
    const cfg = window.CHOW45_MAP_CONFIG || {};

    const casing = new window.google.maps.Polyline({
      path,
      strokeColor: cfg.routeCasing || '#FFFFFF',
      strokeOpacity: 0.95,
      strokeWeight: cfg.routeCasingWidth || 7,
      map
    });

    const line = new window.google.maps.Polyline({
      path,
      strokeColor: cfg.routeColor || '#1A73E8',
      strokeOpacity: 1.0,
      strokeWeight: cfg.routeWidth || 4,
      map
    });

    this.routePolylines[containerId] = { casing, line };
  }

  clearRoute(containerId) {
    if (this.routePolylines[containerId]) {
      const { casing, line } = this.routePolylines[containerId];
      if (casing) casing.setMap(null);
      if (line) line.setMap(null);
      delete this.routePolylines[containerId];
    }
  }

  // -------------------------------------------------------------
  // DELIVERY QUOTE
  // -------------------------------------------------------------
  async getDeliveryQuote(store, deliveryLocation, opts = {}) {
    // 1. Resolve store origin coordinates with campus fallbacks
    let originLat = store ? (store.lat ?? store.latitude) : null;
    let originLng = store ? (store.lng ?? store.longitude) : null;
    if (originLat == null || originLng == null || (Number(originLat) === 0 && Number(originLng) === 0)) {
      const addr = ((store?.address || '') + ' ' + (store?.name || '')).toLowerCase();
      if (addr.includes('oou') || addr.includes('ago-iwoye') || addr.includes('ago iwoye')) {
        originLat = 6.9320; originLng = 3.9180;
      } else if (addr.includes('babcock') || addr.includes('ilishan')) {
        originLat = 6.8900; originLng = 3.7200;
      } else if (addr.includes('ibogun')) {
        originLat = 6.9050; originLng = 3.1600;
      } else {
        originLat = 6.8400; originLng = 3.6500; // Sagamu OSUTH default
      }
    }

    // 2. Resolve dropoff coordinates with campus fallbacks
    let destLat = deliveryLocation ? (deliveryLocation.latitude ?? deliveryLocation.lat) : null;
    let destLng = deliveryLocation ? (deliveryLocation.longitude ?? deliveryLocation.lng) : null;
    if (destLat == null || destLng == null || (Number(destLat) === 0 && Number(destLng) === 0)) {
      const name = ((deliveryLocation?.name || '') + ' ' + (deliveryLocation?.formattedAddress || '')).toLowerCase();
      if (name.includes('oou') || name.includes('ago-iwoye') || name.includes('ago iwoye')) {
        destLat = 6.9320; destLng = 3.9180;
      } else if (name.includes('babcock') || name.includes('ilishan')) {
        destLat = 6.8900; destLng = 3.7200;
      } else if (name.includes('ibogun')) {
        destLat = 6.9050; destLng = 3.1600;
      } else {
        destLat = 6.8482; destLng = 3.6545; // Sagamu Campus dropoff default
      }
    }

    const origin = { lat: Number(originLat), lng: Number(originLng) };
    const dest = { lat: Number(destLat), lng: Number(destLng) };

    const clientRoute = await this.getDirections(origin, dest);
    const haversineDist = typeof haversineDistanceMeters === 'function' ? haversineDistanceMeters(origin, dest) : 2500;
    const fallbackRoute = clientRoute || {
      distanceMeters: haversineDist,
      durationSeconds: Math.round((haversineDist / 500) * 60),
      geometry: null
    };

    const config = opts.config || (typeof safeDeliveryConfig === 'function' ? safeDeliveryConfig() : {});
    const zone = typeof getServiceAvailability === 'function' ? getServiceAvailability(dest).zone : null;

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
        const dist = server.distanceMeters ?? fallbackRoute.distanceMeters;
        const dur = server.durationSeconds ?? fallbackRoute.durationSeconds;
        if (typeof buildDeliveryQuote === 'function') {
          return buildDeliveryQuote(
            dist,
            dur,
            zone,
            config
          );
        }
        const srvFee = server.deliveryFee || Math.max(200, Math.ceil((dist / 1000) * 200));
        return {
          distanceMeters: dist,
          durationSeconds: dur,
          deliveryFee: srvFee,
          deliveryFeeLabel: typeof formatNaira === 'function' ? formatNaira(srvFee) : `₦${srvFee.toLocaleString()}`,
          distanceLabel: `${(dist / 1000).toFixed(1)} km`,
          durationLabel: `${Math.ceil(dur / 60)} mins`
        };
      }
    } catch (err) {
      console.warn('Delivery quote API unavailable, using client calculations.', err);
    }

    if (typeof buildDeliveryQuote === 'function') {
      return buildDeliveryQuote(fallbackRoute.distanceMeters, fallbackRoute.durationSeconds, zone, config);
    }

    const calculatedFee = typeof calculateDeliveryFee === 'function'
      ? calculateDeliveryFee(fallbackRoute.distanceMeters, config)
      : Math.max(200, Math.ceil((fallbackRoute.distanceMeters / 1000) * 200));

    return {
      distanceMeters: fallbackRoute.distanceMeters,
      durationSeconds: fallbackRoute.durationSeconds,
      deliveryFee: calculatedFee,
      deliveryFeeLabel: typeof formatNaira === 'function' ? formatNaira(calculatedFee) : `₦${calculatedFee.toLocaleString()}`,
      distanceLabel: `${(fallbackRoute.distanceMeters / 1000).toFixed(1)} km`,
      durationLabel: `${Math.ceil(fallbackRoute.durationSeconds / 60)} mins`
    };
  }

  // -------------------------------------------------------------
  // LIVE TRACKING MISSION
  // -------------------------------------------------------------
  async renderDeliveryMission(order, store, customerLocation) {
    this.clearMarkers();
    const containerId = 'mapbox-canvas';
    const custCoord = [
      customerLocation.lng ?? (customerLocation.longitude ?? 3.6545),
      customerLocation.lat ?? (customerLocation.latitude ?? 6.8482)
    ];
    const storeCoord = [
      store.lng || store.longitude || 3.6530,
      store.lat || store.latitude || 6.8475
    ];

    const map = await this.initMap(containerId, { initCenter: custCoord, zoom: 13.5 });
    if (!map) return;

    const state = (window.chowStore && window.chowStore.state) || {};
    const rider = (state.riders && state.riders[0]) || {
      name: 'Chow45 Rider',
      currentLat: storeCoord[1],
      currentLng: storeCoord[0]
    };
    const riderCoord = [
      rider.currentLng ?? (storeCoord[0] + custCoord[0]) / 2,
      rider.currentLat ?? (storeCoord[1] + custCoord[1]) / 2
    ];

    map.panTo({ lat: custCoord[1], lng: custCoord[0] });
    this.clearRoute(containerId);

    // Store Marker
    const storeEl = this._pinElement('store');
    storeEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
    this.pixelMarkers.store = this.addMarker(map, 'store', storeCoord, {
      svg: storeEl.innerHTML,
      popupHtml: `<strong>${store.name || 'Pickup Spot'}</strong><br><small>Restaurant</small>`
    });

    // Customer Marker
    const custEl = this._pinElement('customer');
    custEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    this.pixelMarkers.customer = this.addMarker(map, 'customer', custCoord, {
      svg: custEl.innerHTML,
      popupHtml: `<strong>Delivery Point</strong><br><small>${order.deliveryAddress || 'Home'}</small>`
    });

    // Rider Marker
    const riderEl = this._pinElement('rider');
    riderEl.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M15 6h-5l-3 6.5h6l3-6.5z"/><path d="M19 17.5l-4-7.5h-5"/></svg>`;
    this.pixelMarkers.rider = this.addMarker(map, 'rider', riderCoord, {
      svg: riderEl.innerHTML,
      popupHtml: `<strong>${order.riderName || rider.name}</strong><br><small>Chow45 Express Dispatch</small>`
    });

    // Compute and draw Google route
    const route = await this.getDirections(storeCoord, custCoord);
    if (route && route.geometry) {
      this.drawRoute(containerId, route.geometry);
    }

    this.fitBounds(containerId, [storeCoord, custCoord, riderCoord], 80);
    this.startRiderSimulation(order.status, riderCoord, storeCoord, custCoord);
  }

  startRiderSimulation(status, riderCoord, storeCoord, custCoord) {
    if (this.routeAnimationTimer) clearInterval(this.routeAnimationTimer);

    if (status === 'DELIVERED') {
      if (this.pixelMarkers.rider) {
        this.pixelMarkers.rider.setLngLat(custCoord);
      }
      return;
    }

    const headingToCustomer = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'RIDER_NEARBY'].includes(status);
    const start = headingToCustomer ? storeCoord : riderCoord;
    const end = headingToCustomer ? custCoord : storeCoord;

    if (!this.pixelMarkers.rider) return;
    this.pixelMarkers.rider.setLngLat(start);

    let progress = 0;
    this.routeAnimationTimer = setInterval(() => {
      if (!this.pixelMarkers.rider) {
        clearInterval(this.routeAnimationTimer);
        return;
      }
      progress += 0.025;
      if (progress > 1) progress = 0;
      this.pixelMarkers.rider.setLngLat([
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress
      ]);
    }, 400);
  }

  updateRiderPosition(lng, lat) {
    if (this.routeAnimationTimer) {
      clearInterval(this.routeAnimationTimer);
      this.routeAnimationTimer = null;
    }
    const numLng = Number(lng);
    const numLat = Number(lat);
    if (!Number.isFinite(numLng) || !Number.isFinite(numLat)) return;
    if (this.pixelMarkers && this.pixelMarkers.rider) {
      this.pixelMarkers.rider.setLngLat([numLng, numLat]);
    }
  }

  // -------------------------------------------------------------
  // ZONE POLYGON EDITOR (Admin Service Areas)
  // -------------------------------------------------------------
  renderZonePolygonEditor(containerId, zone, onChange) {
    const map = this.getMap(containerId);
    if (!map) return [];

    this._removePixelMarkers();
    this.clearRoute(containerId);

    const vertexMarkers = (zone.polygon || []).map((coord, idx) => {
      const el = this._pinElement('vertex');
      el.innerHTML = `<span style="font-weight:800;font-size:12px;">${idx + 1}</span>`;
      const marker = this.addMarker(map, 'vertex', coord, {
        svg: el.innerHTML,
        draggable: true
      });

      if (marker) {
        const onDrag = () => {
          const p = marker.position ? marker.position : (marker.getPosition ? marker.getPosition() : null);
          if (!p) return;
          const nLat = typeof p.lat === 'function' ? p.lat() : p.lat;
          const nLng = typeof p.lng === 'function' ? p.lng() : p.lng;
          zone.polygon[idx] = [nLng, nLat];
          if (onChange) onChange(zone);
        };
        if (typeof marker.addEventListener === 'function') {
          marker.addEventListener('drag', onDrag);
        } else if (marker.addListener) {
          marker.addListener('drag', onDrag);
        }
      }
      return marker;
    });

    this.pixelMarkers.zoneVertices = vertexMarkers;
    return vertexMarkers;
  }

  drawZonePolygon(map, polygon, color = '#0C513F') {
    if (!map || !window.google || !window.google.maps) return;

    if (this.editorPolygon) {
      this.editorPolygon.setMap(null);
    }

    const paths = (polygon || []).map((p) => ({ lat: p[1], lng: p[0] }));
    const cfg = window.CHOW45_MAP_CONFIG || {};

    this.editorPolygon = new window.google.maps.Polygon({
      paths,
      strokeColor: color || cfg.zoneLineColor || '#0C513F',
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: cfg.zoneFillColor || '#00B978',
      fillOpacity: 0.18,
      map
    });
  }

  clearMarkers() {
    this._removePixelMarkers();
    if (this.routeAnimationTimer) clearInterval(this.routeAnimationTimer);
  }

  removeMap(containerId) {
    if (this.maps[containerId]) {
      this.clearRoute(containerId);
      delete this.maps[containerId];
    }
  }
}

// Instantiate and expose globally as window.chowMap and window.chowGoogleMap
window.GoogleMapsService = GoogleMapsService;
window.chowGoogleMap = window.chowGoogleMap || new GoogleMapsService();
window.chowMap = window.chowGoogleMap;
