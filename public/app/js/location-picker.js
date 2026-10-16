/**
 * CHOW45 LOCATION PICKER
 * Full-screen Mapbox location selector with:
 *  - Browser GPS (accuracy validated)
 *  - Manual address search (Mapbox geocoding)
 *  - Movable centered map pin
 *  - Coordinate-based service-zone validation (see service-zones.js)
 *  - Availability states + address confirmation card / bottom sheet
 *
 * Flow: DEVICE GPS -> LAT/LNG -> ACCURACY -> REVERSE GEOCODE ->
 *       STATE/LGA -> SERVICE ZONE -> DELIVERY AVAILABLE/UNAVAILABLE
 */

const Chow45LocationPicker = {
  containerId: 'picker-map-canvas',
  map: null,
  currentLocation: null,     // structured location object {lat,lng,address,...}
  resolving: false,
  searchTimer: null,
  lastSearchQuery: '',
  _isLocating: false,
  _gpsRequestId: 0,
  _suppressPinMove: false,

  setGpsButtonState(state) {
    const btn = document.getElementById('picker-gps-btn');
    const fab = document.getElementById('picker-gps-fab');
    const modalBtn = document.getElementById('location-modal-gps-btn');

    if (btn) {
      const spinner = btn.querySelector('.picker-gps-spinner');
      const label = btn.querySelector('.picker-gps-label');
      const icon = btn.querySelector('.picker-gps-icon');

      if (state === 'detecting') {
        btn.disabled = true;
        btn.classList.add('loading');
        if (spinner) spinner.style.display = 'inline-block';
        if (icon) icon.style.display = 'none';
        if (label) label.textContent = 'Detecting your location...';
      } else {
        btn.disabled = false;
        btn.classList.remove('loading');
        if (spinner) spinner.style.display = 'none';
        if (icon) icon.style.display = '';
        if (label) label.textContent = 'Get My Live Location';
      }
    }

    if (fab) {
      const spinner = fab.querySelector('.picker-gps-spinner');
      const icon = fab.querySelector('.picker-gps-icon');

      if (state === 'detecting') {
        fab.disabled = true;
        fab.classList.add('loading');
        if (spinner) spinner.style.display = 'inline-block';
        if (icon) icon.style.display = 'none';
      } else {
        fab.disabled = false;
        fab.classList.remove('loading');
        if (spinner) spinner.style.display = 'none';
        if (icon) icon.style.display = '';
      }
    }

    if (modalBtn) {
      if (state === 'detecting') {
        modalBtn.disabled = true;
        modalBtn.textContent = '⏳ Detecting your location...';
      } else {
        modalBtn.disabled = false;
        modalBtn.textContent = '📍 Get My Live Location';
      }
    }
  },

  open(opts) {
    const modal = document.getElementById('map-picker-modal');
    if (!modal) return;

    this.bindEvents();

    this.onConfirmCallback = (opts && opts.onConfirm) || null;
    this.mode = (opts && opts.mode) || 'delivery'; // 'delivery' | 'pickup'

    const saved = window.chowStore.state.selectedLocation;
    const initial = {
      lng: saved.lng ?? (saved.longitude ?? 3.6545),
      lat: saved.lat ?? (saved.latitude ?? 6.8482)
    };

    this.currentLocation = null;
    this.hideResults();
    this.hideSavedAddresses();

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    this.clearStatus();
    this.setConfirmState('resolving');

    setTimeout(() => this.bootMap(initial), 60);
    setTimeout(() => {
      if (this.map && window.google && window.google.maps) {
        window.google.maps.event.trigger(this.map, 'resize');
        const c = this.map.getCenter();
        if (c) this.map.setCenter(c);
      }
    }, 250);
    setTimeout(() => {
      const input = document.getElementById('picker-search-input');
      if (input) input.focus({ preventScroll: true });
    }, 200);
  },

  close() {
    const modal = document.getElementById('map-picker-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    this.hideResults();
    this.mode = 'delivery';
    if (window.chowMap) window.chowMap.removeAccuracyCircle(this.map);
  },

  async bootMap(initial) {
    if (!window.chowMap) return;
    if (!window.CHOW45_MAPBOX_CONFIG || !window.CHOW45_MAPBOX_CONFIG.token) {
      this.setMapError('Unable to load the map.');
      return;
    }

    this.map = await window.chowMap.initMap(this.containerId, {
      initCenter: [initial.lng, initial.lat],
      zoom: 16.5,
      onLoad: () => {
        this.onPinMoved();
      },
      onMoveSettled: () => this.onPinMoved()
    });

    if (this.map) {
      window.chowMap.renderServiceZones(this.containerId);
      setTimeout(() => {
        if (window.google && window.google.maps) {
          window.google.maps.event.trigger(this.map, 'resize');
          const c = this.map.getCenter();
          if (c) this.map.setCenter(c);
        }
      }, 150);
    } else {
      this.setMapError('Unable to load the map.');
    }
  },

  setMapError(message) {
    const banner = document.getElementById('picker-status-banner');
    if (!banner) return;
    this.setConfirmState('blocked');
    banner.className = 'picker-status-banner error open';
    banner.innerHTML = `
      <div>
        <strong>${message}</strong>
        <p>Mapbox failed to initialize on your device.</p>
      </div>
      <button class="picker-chip-btn" onclick="Chow45LocationPicker.retryMap()">Retry</button>
    `;
  },

  async retryMap() {
    const tokenErr = window.CHOW45_MAPBOX_TOKEN_ERROR;
    if (tokenErr || !(window.CHOW45_MAPBOX_CONFIG || {}).token) {
      window.chowApp && window.chowApp.toast('Mapbox token is not configured for this deployment.', 'error');
      return;
    }
    if (window.chowMap) {
      window.chowMap.removeMap(this.containerId);
      this.map = await window.chowMap.initMap(this.containerId, {
        initCenter: [window.chowStore.state.selectedLocation.lng ?? 3.6545, window.chowStore.state.selectedLocation.lat ?? 6.8482],
        zoom: 14.5
      });
      if (this.map) {
        document.getElementById('picker-status-banner').className = 'picker-status-banner';
        this.onPinMoved();
      }
    }
  },

  // -------------------------------------------------------------
  // GPS & LIVE LOCATION DETECTION
  // -------------------------------------------------------------
  useCurrentLocation() {
    if (this._isLocating) {
      console.log('[GPS] Location detection already in progress. Ignoring duplicate trigger.');
      return;
    }

    this._gpsRequestId = (this._gpsRequestId || 0) + 1;
    const reqId = this._gpsRequestId;
    console.log(`[GPS #${reqId}] Requesting live location...`);

    // 1. Verify browser support
    if (!navigator.geolocation) {
      this.onGpsError({ code: 0, message: 'Browser geolocation is not supported on this device.' }, reqId);
      return;
    }

    // 2. Verify secure context (HTTPS required by modern browsers, localhost is exempt)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      this.onGpsError({
        code: 0,
        message: 'Live location requires a secure HTTPS connection. Please use HTTPS or search manually.'
      }, reqId);
      return;
    }

    this._isLocating = true;
    this.setGpsButtonState('detecting');
    this.setStatus(null, 'Detecting your location…');
    this.setConfirmState('resolving');

    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Detecting GPS location…', 'info');
    }

    // Inspect permission status if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        console.log(`[GPS #${reqId}] Geolocation permission status:`, status.state);
        if (status.state === 'denied') {
          console.warn(`[GPS #${reqId}] Location permission is explicitly blocked.`);
        }
      }).catch(() => {});
    }

    let resolved = false;
    let watchId = null;

    const clearGpsWatch = () => {
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch {}
        watchId = null;
      }
    };

    const handleSuccess = (position) => {
      if (resolved || reqId !== this._gpsRequestId) return;
      resolved = true;
      clearGpsWatch();
      this.onGpsSuccess(position, reqId);
    };

    const handleFallbackOrError = (err) => {
      if (resolved || reqId !== this._gpsRequestId) return;
      clearGpsWatch();

      // If user denied permission (Code 1), respect permission denial immediately
      if (err && err.code === 1) {
        resolved = true;
        this.onGpsError(err, reqId);
        return;
      }

      console.log(`[GPS #${reqId}] High-accuracy failed/timed out, attempting low-accuracy fallback...`);
      navigator.geolocation.getCurrentPosition(
        (pos) => handleSuccess(pos),
        (lowErr) => {
          if (resolved || reqId !== this._gpsRequestId) return;
          resolved = true;
          if (lowErr && lowErr.code === 1) {
            this.onGpsError(lowErr, reqId);
          } else {
            this.tryNetworkIpFallback(lowErr, reqId);
          }
        },
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
      );
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = pos.coords.accuracy || 999;
          handleSuccess(pos);
          if (acc <= 50) clearGpsWatch();
        },
        (err) => {
          handleFallbackOrError(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 5000
        }
      );

      // Timeout fallback if watch does not resolve in 6s
      setTimeout(() => {
        if (!resolved && reqId === this._gpsRequestId) {
          handleFallbackOrError({ code: 3, message: 'GPS request timed out' });
        }
      }, 6000);
    } catch (e) {
      handleFallbackOrError(e);
    }
  },

  async tryNetworkIpFallback(reasonErr, reqId) {
    if (reqId && reqId !== this._gpsRequestId) return;
    this.setStatus(null, 'Checking approximate network location…');
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const d = await res.json();
        if (d.success !== false && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
          if (reqId && reqId !== this._gpsRequestId) return;
          console.log(`[GPS #${reqId}] Network IP location obtained: [${d.longitude}, ${d.latitude}]`);
          if (window.chowApp && window.chowApp.toast) {
            window.chowApp.toast('Approximate location detected from network. Fine-tune by dragging pin.', 'info');
          }
          this.onGpsSuccess({
            coords: {
              latitude: d.latitude,
              longitude: d.longitude,
              accuracy: 2500
            }
          }, reqId);
          return;
        }
      }
    } catch (e) {}

    this.onGpsError(reasonErr || { code: 2, message: 'Could not detect location' }, reqId);
  },

  onGpsSuccess(position, reqId) {
    if (reqId && reqId !== this._gpsRequestId) {
      console.warn(`[GPS] Discarding stale GPS callback #${reqId} (active is #${this._gpsRequestId})`);
      return;
    }

    this._isLocating = false;
    this.setGpsButtonState('success');
    setTimeout(() => {
      if (!this._isLocating) this.setGpsButtonState('idle');
    }, 1500);

    const { latitude, longitude, accuracy } = position.coords;
    console.log(`[GPS #${reqId || 0}] Position acquired: lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}, accuracy=${Math.round(accuracy || 0)}m`);

    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Location acquired! ✓', 'success');
    }

    if (typeof accuracy === 'number' && accuracy > 500) {
      this.setStatus('warning', 'Approximate location detected. Drag the pin to your exact building.');
      const banner = document.getElementById('picker-status-banner');
      if (banner) {
        banner.className = 'picker-status-banner warning open';
        banner.innerHTML = `
          <div>
            <strong>Approximate location detected (~${Math.round(accuracy)}m).</strong>
            <p>Drag the map so the pin points right at your gate or building.</p>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="picker-chip-btn" onclick="Chow45LocationPicker.useCurrentLocation()">Retry GPS</button>
            <button class="picker-chip-btn" onclick="document.getElementById('picker-search-input').focus()">Search manually</button>
          </div>
        `;
      }
    }

    this.setStatus(null, 'Pinpointing delivery location…');
    this.setConfirmState('resolving');

    // Programmatic map fly: suppress onPinMoved during transition to prevent race condition
    this._suppressPinMove = true;
    setTimeout(() => { this._suppressPinMove = false; }, 1200);

    if (this.map && window.chowMap) {
      window.chowMap.flyTo(this.containerId, longitude, latitude, 17.5);
      window.chowMap.showAccuracyCircle(this.map, { lng: longitude, lat: latitude }, accuracy);
    }

    if (window.chowMap && typeof window.chowMap.resolveLocation === 'function') {
      window.chowMap.resolveLocation(longitude, latitude, { accuracy, timestamp: Date.now() })
        .then((loc) => {
          if (!reqId || reqId === this._gpsRequestId) {
            this.presentResolved(loc);
          }
        })
        .catch(() => {
          if (!reqId || reqId === this._gpsRequestId) {
            this.resolveAndPresent({ lng: longitude, lat: latitude, accuracy, timestamp: Date.now() });
          }
        });
    } else {
      this.resolveAndPresent({ lng: longitude, lat: latitude, accuracy, timestamp: Date.now() });
    }
  },

  onGpsError(err, reqId) {
    if (reqId && reqId !== this._gpsRequestId) return;

    this._isLocating = false;
    this.setGpsButtonState('error');
    setTimeout(() => {
      if (!this._isLocating) this.setGpsButtonState('idle');
    }, 2500);

    const code = err && err.code;
    const msg = err && err.message ? err.message : '';
    console.warn(`[GPS #${reqId || 0}] Geolocation error (code ${code}):`, msg);

    if (code === 1) { // PERMISSION_DENIED
      const title = 'Location permission denied';
      const detail = 'Please tap the lock or tune icon 🔒 in your browser address bar to allow location access, or select your campus zone below.';
      this.setGpsError(title, detail, 'Search manually');
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Location permission denied. Tap the lock icon in the address bar to allow.', 'warning');
      }
    } else if (code === 2) { // POSITION_UNAVAILABLE
      const title = 'Location unavailable';
      const detail = 'Unable to determine your physical position. Ensure device GPS / location services are switched on, or search manually.';
      this.setGpsError(title, detail, 'Retry GPS');
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('GPS signal unavailable. Please ensure location services are enabled.', 'warning');
      }
    } else if (code === 3) { // TIMEOUT
      const title = 'Location detection timed out';
      const detail = 'Your device took too long to return GPS coordinates. Tap "Retry GPS" or pick your campus zone directly.';
      this.setGpsError(title, detail, 'Retry GPS');
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Location detection timed out. Click to retry.', 'warning');
      }
    } else {
      const title = 'Could not detect location';
      const detail = msg || 'Could not acquire location automatically. Search your street name or choose your campus zone below.';
      this.setGpsError(title, detail, 'Search manually');
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast(title + '. Please search or choose a zone.', 'warning');
      }
    }
  },

  setGpsError(title, detail, action) {
    this.setStatus('error', title);
    this.setConfirmState('blocked');
    const banner = document.getElementById('picker-status-banner');
    if (banner) {
      const click = action === 'Retry GPS'
        ? `Chow45LocationPicker.useCurrentLocation()`
        : `document.getElementById('picker-search-input').focus()`;
      banner.className = 'picker-status-banner error open';
      banner.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <strong style="color: #DC2626; font-size: 0.92rem; display: block;">${title}</strong>
          <p style="margin: 3px 0 0; font-size: 0.8rem; color: #4B5563; line-height: 1.35;">${detail}</p>
        </div>
        <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
          <button class="picker-chip-btn" onclick="${click}">${action}</button>
          <button class="picker-chip-btn" onclick="Chow45LocationPicker.flyToZone('ifo')">📍 Moboluwaduro</button>
        </div>
      `;
    }
  },

  // -------------------------------------------------------------
  // QUICK ZONE JUMP (for 1-tap navigation to active Ogun State zones)
  // -------------------------------------------------------------
  flyToZone(zoneKey) {
    const zones = {
      ifo: { lng: 3.1975, lat: 6.8111, name: 'Ifo / Moboluwaduro Zone' },
      sagamu: { lng: 3.6139, lat: 6.8270, name: 'Sagamu (OOUTH)' },
      agoiwoye: { lng: 3.6545, lat: 6.8482, name: 'Ago-Iwoye (OOU Main Campus)' },
      ibogun: { lng: 3.3900, lat: 6.7200, name: 'Ibogun Campus' }
    };
    const target = zones[zoneKey];
    if (!target) return;

    this.setStatus(null, `Navigating to ${target.name}…`);
    this.setConfirmState('resolving');

    if (this.map && window.chowMap) {
      window.chowMap.flyTo(this.containerId, target.lng, target.lat, 16.5);
    }

    window.chowMap.resolveLocation(target.lng, target.lat, { accuracy: 15, timestamp: Date.now() })
      .then((loc) => this.presentResolved(loc));
  },

  // -------------------------------------------------------------
  // MOVABLE PIN (map pans, pin stays centered)
  // -------------------------------------------------------------
  onPinMoved() {
    if (this._suppressPinMove) {
      console.log('[LocationPicker] Suppressing onPinMoved during active GPS transition');
      return;
    }
    const map = window.chowMap && window.chowMap.getMap(this.containerId);
    if (!map) return;
    if (this.resolving) {
      this._pendingPinMove = true;
      return;
    }

    this.setConfirmState('resolving');
    this.setStatus(null, 'Pinpointing delivery location…');

    const c = map.getCenter();
    if (!c) return;
    const lng = typeof c.lng === 'function' ? c.lng() : (c.lng ?? (Array.isArray(c) ? c[0] : c.longitude));
    const lat = typeof c.lat === 'function' ? c.lat() : (c.lat ?? (Array.isArray(c) ? c[1] : c.latitude));
    const numLng = Number(lng) || 3.1975;
    const numLat = Number(lat) || 6.8111;
    this.resolveAndPresent({ lng: numLng, lat: numLat, accuracy: null, timestamp: Date.now() }, true);
  },

  // -------------------------------------------------------------
  // MANUAL SEARCH
  // -------------------------------------------------------------
  onSearchInput() {
    const input = document.getElementById('picker-search-input');
    if (!input) return;
    const q = input.value;

    clearTimeout(this.searchTimer);
    if (q.trim().length < 2) {
      this.hideResults();
      this.renderSavedAddresses();
      return;
    }

    const cfg = window.CHOW45_MAP_CONFIG || window.CHOW45_MAPBOX_CONFIG || {};
    this.searchTimer = setTimeout(async () => {
      const results = await window.chowMap.searchAddress(q);
      this.renderResults(results);
    }, cfg.searchDebounceMs || 300);
  },

  renderResults(results) {
    const container = document.getElementById('picker-search-results');
    if (!container) return;
    this.hideSavedAddresses();
    this._currentSearchResults = results || [];

    if (!results || results.length === 0) {
      container.className = 'picker-search-results open';
      container.innerHTML = `
        <div class="picker-search-empty">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>No exact match found. Try a street, building, or area name (e.g. “Lagos-Abeokuta”, “Moboluwaduro”, “Hospital Road”).</span>
        </div>`;
      return;
    }

    container.className = 'picker-search-results open';
    container.innerHTML = results.map((r, idx) => `
      <button type="button" class="picker-result-item" onclick="Chow45LocationPicker.selectResultByIndex(${idx})">
        <span class="picker-result-icon">📍</span>
        <span style="display:flex; flex-direction:column; text-align:left;">
          <strong style="color:#0F172A; font-size:0.9rem;">${r.text}</strong>
          <small style="color:#64748B; font-size:0.78rem;">${r.placeName}</small>
        </span>
      </button>
    `).join('');
  },

  async selectResultByIndex(idx) {
    const result = (this._currentSearchResults || [])[idx];
    if (!result) return;
    await this.selectResult(result);
  },

  async selectResult(result) {
    this.currentLocation = null;
    this.setConfirmState('resolving');
    this.setStatus(null, 'Pinpointing street location…');

    let lng = result.lng;
    let lat = result.lat;
    let formattedAddress = result.placeName || result.text;

    // If coordinates are missing (from Google Places New prediction), resolve them by placeId
    if ((!Number.isFinite(lng) || !Number.isFinite(lat)) && result.placeId) {
      if (window.chowMap && typeof window.chowMap.getPlaceDetails === 'function') {
        const details = await window.chowMap.getPlaceDetails(result.placeId);
        if (details && Number.isFinite(details.lng) && Number.isFinite(details.lat)) {
          lng = details.lng;
          lat = details.lat;
          if (details.formattedAddress) formattedAddress = details.formattedAddress;
        }
      }
    }

    // Secondary fallback coordinates if completely unresolvable
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      lng = 3.6545;
      lat = 6.8482;
    }

    if (this.map && window.chowMap) {
      window.chowMap.flyTo(this.containerId, lng, lat, 17);
    }

    const input = document.getElementById('picker-search-input');
    if (input) input.value = result.text || formattedAddress;
    this.hideResults();

    window.chowMap.resolveLocation(lng, lat, { timestamp: Date.now() })
      .then((loc) => {
        loc.placeId = result.placeId || loc.placeId;
        loc.address = result.text || loc.address;
        loc.formattedAddress = formattedAddress || loc.formattedAddress;
        this.presentResolved(loc);
        this.confirmLocation();
      })
      .catch(() => {
        this.resolveAndPresent({ lng, lat, accuracy: null, timestamp: Date.now() });
      });
  },

  // -------------------------------------------------------------
  // RESOLUTION & AVAILABILITY PRESENTATION
  // -------------------------------------------------------------
  async resolveAndPresent(point) {
    this.resolving = true;
    try {
      const pLng = typeof point.lng === 'function' ? point.lng() : (point.lng ?? point.longitude ?? point[0]);
      const pLat = typeof point.lat === 'function' ? point.lat() : (point.lat ?? point.latitude ?? point[1]);
      const numLng = Number(pLng) || 3.6545;
      const numLat = Number(pLat) || 6.8482;

      const loc = await window.chowMap.resolveLocation(numLng, numLat, {
        accuracy: point.accuracy,
        timestamp: point.timestamp
      });
      this.presentResolved(loc);
    } catch (e) {
      console.warn('[LocationPicker] Location resolution fallback engaged:', e);
      const pLng = Number(typeof point.lng === 'function' ? point.lng() : (point.lng ?? point.longitude ?? point[0] ?? 3.6545)) || 3.6545;
      const pLat = Number(typeof point.lat === 'function' ? point.lat() : (point.lat ?? point.latitude ?? point[1] ?? 6.8482)) || 6.8482;
      const availability = typeof getServiceAvailability === 'function'
        ? getServiceAvailability({ lng: pLng, lat: pLat })
        : { status: 'available', inOgun: true, isSupported: true, zone: null };
      const zoneName = availability && availability.zone ? availability.zone.name : null;
      const zoneLga = availability && availability.zone ? availability.zone.lga : 'Ogun State';
      const addressLabel = zoneName
        ? `${zoneName} (${pLat.toFixed(4)}, ${pLng.toFixed(4)})`
        : `Pinned Location (${pLat.toFixed(4)}, ${pLng.toFixed(4)})`;

      const fallbackLoc = {
        latitude: pLat,
        longitude: pLng,
        accuracy: point.accuracy || null,
        timestamp: Date.now(),
        address: addressLabel,
        street: addressLabel,
        locality: zoneName || 'Ogun',
        place: zoneName || 'Ogun',
        lga: zoneLga,
        state: 'Ogun',
        country: 'Nigeria',
        placeId: null,
        formattedAddress: `${addressLabel}, Ogun State, Nigeria`,
        availability
      };
      this.presentResolved(fallbackLoc);
    } finally {
      this.resolving = false;
      if (this._pendingPinMove) {
        this._pendingPinMove = false;
        setTimeout(() => this.onPinMoved(), 60);
      }
    }
  },

  editExactDetails() {
    const loc = this.currentLocation;
    const current = loc ? (loc.customNote || loc.address || '') : '';
    const landmark = prompt('Enter your exact compound, house number or landmark in this area:\n(e.g., House 12, Green gate beside Transformer, Moboluwaduro CDA)', current);
    if (landmark && landmark.trim()) {
      const val = landmark.trim();
      if (!this.currentLocation) this.currentLocation = {};
      this.currentLocation.customNote = val;
      this.currentLocation.address = val;
      this.currentLocation.formattedAddress = `${val}, ${this._subtitleFromAddress(this.currentLocation)}`;
      this.currentLocation.deliveryInstructions = val;
      this.presentResolved(this.currentLocation);
      window.chowApp && window.chowApp.toast('Exact address details updated! ✓', 'success');
    }
  },

  presentResolved(loc) {
    this.currentLocation = loc;
    window.chowMap.removeAccuracyCircle(this.map);

    const addressText = document.getElementById('picker-address-text');
    if (addressText) {
      const customNote = loc.customNote || '';
      addressText.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:210px;">${customNote ? customNote : this._titleFromAddress(loc)}</strong>
          <button type="button" onclick="Chow45LocationPicker.editExactDetails()" style="border:none; background:#E8F6F0; color:#00a205; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:6px; cursor:pointer;" title="Add specific building, flat or landmark">✏️ Edit</button>
        </div>
        <span style="display:block; font-size:0.78rem; color:#6E6D66; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px;">${this._subtitleFromAddress(loc)}</span>
      `;
    }

    // Pickup mode (store onboarding): location is accepted as-is, no
    // delivery-zone gating and no global delivery-location write.
    if (this.mode === 'pickup') {
      const statusEl = document.getElementById('picker-zone-status');
      if (statusEl) {
        statusEl.className = 'picker-zone-status ok';
        statusEl.innerHTML = `<span>✓</span> Pickup point`;
      }
      const banner = document.getElementById('picker-status-banner');
      if (banner) {
        banner.className = 'picker-status-banner success open';
        banner.innerHTML = `
          <div>
            <strong>Pickup address set.</strong>
            <p>${loc.lga ? loc.lga + ', ' : ''}${(loc.state || 'Ogun') + ' State'}</p>
          </div>`;
      }
      this.setConfirmState('ready');
      this.renderConfirmCard();
      return;
    }

    const statusEl = document.getElementById('picker-zone-status');
    const banner = document.getElementById('picker-status-banner');

    const availability = (loc.availability && loc.availability.status === 'available')
      ? loc.availability
      : { status: 'available', inOgun: true, isSupported: true, zone: (loc.availability && loc.availability.zone) || null };
    loc.availability = availability;

    this.setStatus('success', 'Ready for delivery');
    this.setConfirmState('ready');
    if (statusEl) {
      statusEl.className = 'picker-zone-status ok';
      statusEl.innerHTML = `<span>✓</span> ${availability.zone ? availability.zone.name : 'Ready to confirm'}`;
    }
    if (banner) {
      banner.className = 'picker-status-banner';
      banner.innerHTML = '';
    }

    this.renderConfirmCard();
  },

  _titleFromAddress(loc) {
    const isPlusCode = (s) => /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(\b|$)/i.test((s || '').trim());
    const isUnnamed = (s) => /^unnamed\s+road$/i.test((s || '').trim());
    const isPostal = (s) => /^\d{5,6}$/.test((s || '').trim());

    const clean = (s) => {
      if (!s) return '';
      return s.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(?:,\s*|\s+)?/i, '')
              .replace(/^\d{5,6}(?:,\s*|\s+)?/, '')
              .trim();
    };

    let cand = loc.street || loc.address;
    if (cand && (isPlusCode(cand) || isUnnamed(cand) || isPostal(cand))) {
      cand = '';
    }

    if (!cand && loc.formattedAddress) {
      const cleanedFormatted = clean(loc.formattedAddress);
      const firstToken = cleanedFormatted.split(',')[0].trim();
      if (firstToken && !isPlusCode(firstToken) && !isUnnamed(firstToken) && !isPostal(firstToken)) {
        cand = firstToken;
      }
    }

    if (!cand) {
      cand = loc.place || loc.locality || (loc.availability?.zone?.name);
    }

    return cand || clean(loc.formattedAddress) || 'Selected location';
  },

  _subtitleFromAddress(loc) {
    const isPlusCode = (s) => /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(\b|$)/i.test((s || '').trim());
    const clean = (s) => {
      if (!s) return '';
      return s.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(?:,\s*|\s+)?/i, '')
              .replace(/^\d{5,6}(?:,\s*|\s+)?/, '')
              .trim();
    };

    const parts = [loc.lga, loc.state ? loc.state + ' State' : '', loc.country].filter(Boolean);
    const l = [loc.locality, loc.place].filter(s => Boolean(s) && !isPlusCode(s));
    const joined = l.length ? l.join(', ') + (parts.length ? ', ' + parts.join(', ') : '') : parts.join(', ');
    return joined || clean(loc.formattedAddress) || 'Ogun State, Nigeria';
  },

  setStatus(type, message) {
    const zoneStatus = document.getElementById('picker-zone-status');
    if (zoneStatus) {
      zoneStatus.className = 'picker-zone-status ' + (type || 'neutral');
      zoneStatus.innerHTML = type === 'warning'
        ? `<span>⚠</span> ${message}`
        : `<span></span> ${message}`;
    }
  },

  clearStatus() {
    const zoneStatus = document.getElementById('picker-zone-status');
    if (zoneStatus) zoneStatus.className = 'picker-zone-status neutral';
    const banner = document.getElementById('picker-status-banner');
    if (banner) banner.className = 'picker-status-banner';
  },

  // -------------------------------------------------------------
  // CONFIRM CARD / ADDRESS SAVING
  // -------------------------------------------------------------
  setConfirmState(state) {
    const btn = document.getElementById('picker-header-confirm-btn') || document.getElementById('picker-confirm-btn');
    const card = document.getElementById('picker-confirm-card');
    if (btn) {
      btn.dataset.state = state;
      btn.disabled = false;
      if (state === 'resolving') {
        btn.innerHTML = `Checking…`;
      } else {
        btn.innerHTML = `Confirm ✓`;
      }
    }
    if (card) card.classList.remove('blocked');
  },

  renderConfirmCard() {
    // Stationary clutter removed
  },

  getSelectedLabel() {
    return this._currentSavingSlot || 'Campus';
  },

  setLabel(label) {
    this._currentSavingSlot = label;
  },

  async confirmLocation() {
    let loc = this.currentLocation;
    if (!loc) {
      if (this.map && window.chowMap) {
        const center = window.chowMap.getCenter(this.containerId);
        if (center) {
          const latVal = center.latitude ?? center.lat ?? (Array.isArray(center) ? center[1] : 6.8390);
          const lngVal = center.longitude ?? center.lng ?? (Array.isArray(center) ? center[0] : 3.6480);
          const cLat = typeof latVal === 'function' ? latVal() : (Number(latVal) || 6.8111);
          const cLng = typeof lngVal === 'function' ? lngVal() : (Number(lngVal) || 3.1975);
          const avail = typeof getServiceAvailability === 'function' ? getServiceAvailability({ lng: cLng, lat: cLat }) : null;
          const zName = avail && avail.zone ? avail.zone.name : `Pinned Location (${cLat.toFixed(4)}, ${cLng.toFixed(4)})`;
          loc = {
            latitude: cLat,
            longitude: cLng,
            address: zName,
            formattedAddress: `${zName}, Ogun State, Nigeria`,
            state: 'Ogun'
          };
        }
      }
      if (!loc && window.chowStore && window.chowStore.state && window.chowStore.state.selectedLocation) {
        loc = window.chowStore.state.selectedLocation;
      }
    }
    if (!loc) {
      loc = {
        latitude: 6.8111,
        longitude: 3.1975,
        address: 'Moboluwaduro / Ifo Zone',
        formattedAddress: 'Moboluwaduro / Ifo Zone, Ogun State, Nigeria',
        state: 'Ogun'
      };
    }

    const formatted = loc.formattedAddress || loc.address || loc.name || 'Hospital Road, Sagamu, Ogun State, Nigeria';

    // Only treat as vendor pickup if mode was explicitly set to 'pickup' (e.g. from vendor onboarding)
    const isVendorPickup = this.mode === 'pickup';

    const rawLat = loc.latitude ?? loc.lat ?? 6.8390;
    const rawLng = loc.longitude ?? loc.lng ?? 3.6480;
    const numLat = typeof rawLat === 'function' ? rawLat() : (Number(rawLat) || 6.8390);
    const numLng = typeof rawLng === 'function' ? rawLng() : (Number(rawLng) || 3.6480);

    const payload = {
      latitude: numLat,
      longitude: numLng,
      accuracy: loc.accuracy || null,
      timestamp: loc.timestamp || Date.now(),
      address: loc.address || formatted,
      locality: loc.locality || (loc.availability?.zone ? loc.availability.zone.lga.replace(' LGA', '') : (loc.lga || loc.state || 'Local Area')),
      lga: loc.lga || (loc.availability?.zone ? loc.availability.zone.lga : (loc.state ? `${loc.state} State` : 'Delivery Area')),
      state: loc.state || 'Ogun',
      country: loc.country || 'Nigeria',
      placeId: loc.placeId || '',
      formattedAddress: formatted,
      zoneId: loc.availability && loc.availability.zone ? loc.availability.zone.id : (loc.zoneId || 'delivery-zone'),
      zoneName: loc.availability && loc.availability.zone ? loc.availability.zone.name : (loc.zoneName || 'Delivery Area'),
      deliveryInstructions: '',
      label: isVendorPickup ? 'Store Location' : (this.getSelectedLabel() || 'Campus')
    };

    // Save into chowStore
    if (window.chowStore) {
      window.chowStore.setDeliveryLocation(payload);
      if (isVendorPickup) {
        if (window.chowStore.state.vendorOnboarding) {
          window.chowStore.state.vendorOnboarding.storeAddress = formatted;
        }
        if (window.chowStore.state.userProfile) {
          window.chowStore.state.userProfile.storeAddress = formatted;
        }
      } else {
        // Customer delivery address: ensure customer role is active
        if (window.chowStore.state.currentRole !== 'customer') {
          window.chowStore.setRole('customer');
        }
      }
      window.chowStore.save();
    }

    // Update location text in top nav bar and vendor dashboard
    const locTextEl = document.getElementById('current-location-text');
    if (locTextEl) locTextEl.textContent = formatted;
    const vndLocEl = document.getElementById('vendor-store-location');
    if (vndLocEl && isVendorPickup) vndLocEl.innerText = formatted;

    // Ensure customer view is active if confirming customer delivery address
    if (!isVendorPickup) {
      if (window.chowApp && window.chowApp.updateRoleUI) {
        window.chowApp.updateRoleUI('customer');
      }
      // If the user was erroneously on /vendor, return to the customer app
      if (window.location.pathname.startsWith('/vendor')) {
        setTimeout(() => {
          window.location.href = '/app';
        }, 300);
      }
    }

    // 1. Immediately close the map and location picker
    this.close();

    // 2. Show success toast message
    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Location confirmed successfully! ✓', 'success');
    }

    if (typeof this.onConfirmCallback === 'function') {
      const cb = this.onConfirmCallback;
      this.onConfirmCallback = null;
      try { cb(payload); } catch {}
    }
  },

  joinWaitlist() {
    const loc = this.currentLocation;
    const profile = (window.chowStore.state.userProfile) || {};
    const payload = {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      user_type: 'student',
      department: loc ? (loc.locality || loc.lga || '') : ''
    };

    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(() => {
      window.chowApp && window.chowApp.toast('You’re on the waitlist for this area!', 'success');
    }).catch(() => {
      window.chowApp && window.chowApp.toast('You’re on the waitlist for this area!', 'success');
    });

    const btn = document.getElementById('picker-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Joined the waitlist ✓'; }
  },

  // -------------------------------------------------------------
  // SAVED ADDRESSES (User-driven Input & 1-Tap Picks)
  // -------------------------------------------------------------
  renderSavedAddresses() {
    const container = document.getElementById('picker-saved-addresses');
    if (!container) return;
    const saved = window.chowStore.state.userProfile.savedAddresses || [];

    container.className = 'picker-saved-addresses';

    const labels = [
      { key: 'Campus', icon: '🏫', hint: 'e.g. OOU Main Campus Gate, Ago-Iwoye' },
      { key: 'Home', icon: '🏠', hint: 'e.g. Your hostel or residence' },
      { key: 'Work', icon: '💼', hint: 'e.g. Sagamu Campus, OOU Ijagun' }
    ];

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; width:100%;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--c-text-muted); letter-spacing:0.5px; text-transform:uppercase;">YOUR SAVED PLACES</span>
        <span style="font-size:0.75rem; color:var(--c-primary); font-weight:700;">Tap to input & save</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
    `;

    labels.forEach(item => {
      const existing = saved.find(a => a.label && a.label.toLowerCase() === item.key.toLowerCase());
      if (existing) {
        html += `
          <div style="display:flex; align-items:center; gap:8px; width:100%;">
            <button type="button" class="picker-saved-chip" style="flex:1; display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--c-bg-surface); border:1px solid var(--c-border); border-radius:var(--radius-md); text-align:left; cursor:pointer;" onclick="Chow45LocationPicker.useSavedAddress('${item.key}')">
              <span style="font-size:1.15rem;">${item.icon}</span>
              <div style="min-width:0; flex:1;">
                <div style="font-weight:700; font-size:0.85rem; color:var(--c-primary);">${item.key}</div>
                <div style="font-size:0.8rem; color:var(--c-text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${existing.formattedAddress || existing.address}</div>
              </div>
            </button>
            <button type="button" title="Edit ${item.key} address" style="background:#F1EFE8; border:none; color:#0C513F; border-radius:var(--radius-md); padding:10px 12px; font-size:0.85rem; cursor:pointer; font-weight:700;" onclick="Chow45LocationPicker.openSavePlaceModal('${item.key}')">✏️</button>
            <button type="button" title="Remove ${item.key} address" style="background:#FEE2E2; border:none; color:#DC2626; border-radius:var(--radius-md); padding:10px 12px; font-size:0.85rem; cursor:pointer; font-weight:700;" onclick="Chow45LocationPicker.removeSavedAddress('${item.key}')">✕</button>
          </div>
        `;
      } else {
        html += `
          <button type="button" class="picker-saved-chip is-empty" style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:#F8FAFC; border:1.5px dashed #CBD5E1; border-radius:var(--radius-md); text-align:left; cursor:pointer; width:100%; transition:all 0.15s ease;" onclick="Chow45LocationPicker.openSavePlaceModal('${item.key}')">
            <span style="font-size:1.15rem;">${item.icon}</span>
            <div style="min-width:0; flex:1;">
              <div style="font-weight:700; font-size:0.85rem; color:var(--c-text-primary);">+ Input & Save ${item.key} Address</div>
              <div style="font-size:0.78rem; color:var(--c-text-muted);">${item.hint}</div>
            </div>
            <span style="font-size:0.8rem; color:var(--c-primary); font-weight:700; padding:4px 8px; background:rgba(12,81,63,0.08); border-radius:6px;">Set ➔</span>
          </button>
        `;
      }
    });

    const otherSaved = saved.filter(a => !labels.some(l => l.key.toLowerCase() === (a.label || '').toLowerCase()));
    otherSaved.forEach((addr, idx) => {
      html += `
        <div style="display:flex; align-items:center; gap:8px; width:100%;">
          <button type="button" class="picker-saved-chip" style="flex:1; display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--c-bg-surface); border:1px solid var(--c-border); border-radius:var(--radius-md); text-align:left; cursor:pointer;" onclick="Chow45LocationPicker.useSavedAddressByIdx(${idx})">
            <span style="font-size:1.15rem;">📍</span>
            <div style="min-width:0; flex:1;">
              <div style="font-weight:700; font-size:0.85rem; color:var(--c-primary);">${addr.label || 'Saved Place'}</div>
              <div style="font-size:0.8rem; color:var(--c-text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${addr.formattedAddress || addr.address}</div>
            </div>
          </button>
          <button type="button" title="Remove address" style="background:#FEE2E2; border:none; color:#DC2626; border-radius:var(--radius-md); padding:10px 12px; font-size:0.85rem; cursor:pointer; font-weight:700;" onclick="Chow45LocationPicker.removeSavedAddressByIdx(${idx})">✕</button>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  promptSaveSlot(label) {
    this.openSavePlaceModal(label);
  },

  _currentSavingSlot: 'Campus',

  openSavePlaceModal(label) {
    this._currentSavingSlot = label || 'Campus';
    const modal = document.getElementById('save-place-modal');
    if (!modal) return;

    const slotConfigs = {
      'Campus': {
        icon: '🏫',
        name: 'Campus Address',
        hint: 'e.g. OOU Main Campus Gate, Ago-Iwoye',
        placeholder: 'e.g. OOU Main Campus Gate, Ago-Iwoye, Ogun State',
        suggestions: [
          'OOU Main Campus Gate, Ago-Iwoye',
          'OOU Mini Campus, Ago-Iwoye',
          'OOU Teaching Hospital, Sagamu',
          'OGITECH Ibogun Campus, Ifo',
          'Ago-Iwoye Campus Annex'
        ]
      },
      'Home': {
        icon: '🏠',
        name: 'Home Address',
        hint: 'e.g. Your hostel or residence',
        placeholder: 'e.g. Hostel 4, Ago-Iwoye or 9 Goshen Ave, Idimu',
        suggestions: [
          'Ago-Iwoye Town (Hostels)',
          'Sagamu Residential Area',
          '9 Goshen Ave, Idimu, Lagos',
          'Egbeda Bus Stop, Akowonjo Rd, Lagos',
          'Ikeja / Allen Ave, Lagos'
        ]
      },
      'Work': {
        icon: '💼',
        name: 'Work Address',
        hint: 'e.g. Sagamu Campus, OOU Ijagun',
        placeholder: 'e.g. Sagamu Campus, OOU Ijagun or Faculty Office',
        suggestions: [
          'Sagamu Campus, OOU Ijagun',
          'OOUTH Admin Block, Sagamu',
          'Faculty of Science Office, OOU',
          'Ikeja City Mall / Allen Ave, Lagos',
          'Adeniran Ogunsanya, Surulere, Lagos'
        ]
      }
    };

    const config = slotConfigs[this._currentSavingSlot] || {
      icon: '📍',
      name: `${this._currentSavingSlot} Address`,
      hint: 'Your preferred delivery location',
      placeholder: 'Type address or landmark...',
      suggestions: ['OOU Main Campus Gate, Ago-Iwoye', 'OOU Teaching Hospital, Sagamu', 'Idimu, Lagos']
    };

    const titleEl = document.getElementById('save-place-modal-title');
    const subtitleEl = document.getElementById('save-place-modal-subtitle');
    const iconEl = document.getElementById('save-place-slot-icon');
    const nameEl = document.getElementById('save-place-slot-name');
    const hintEl = document.getElementById('save-place-slot-hint');
    const inputEl = document.getElementById('save-place-address-input');
    const noteEl = document.getElementById('save-place-note-input');
    const suggEl = document.getElementById('save-place-suggestions');

    if (titleEl) titleEl.textContent = `Set ${this._currentSavingSlot} Address`;
    if (subtitleEl) subtitleEl.textContent = `Input your ${this._currentSavingSlot.toLowerCase()} location for instant one-tap deliveries`;
    if (iconEl) iconEl.textContent = config.icon;
    if (nameEl) nameEl.textContent = config.name;
    if (hintEl) hintEl.textContent = config.hint;

    // Check if user already has an address saved for this slot
    const saved = window.chowStore.state.userProfile.savedAddresses || [];
    const existing = saved.find(a => (a.label || '').toLowerCase() === this._currentSavingSlot.toLowerCase());

    if (inputEl) {
      inputEl.placeholder = config.placeholder;
      inputEl.value = existing ? (existing.formattedAddress || existing.address || '') : '';
    }
    if (noteEl) {
      noteEl.value = existing ? (existing.deliveryInstructions || '') : '';
    }

    if (suggEl) {
      suggEl.innerHTML = config.suggestions.map(s => `
        <button type="button" style="padding:6px 12px; font-size:0.78rem; font-weight:600; background:#FAF6EB; color:#0C513F; border:1px solid #E6DEC8; border-radius:999px; cursor:pointer; transition:all 0.15s ease;" onclick="Chow45LocationPicker.fillSavePlaceSuggestion('${s.replace(/'/g, "\\'")}')">
          + ${s}
        </button>
      `).join('');
    }

    modal.classList.add('open');

    setTimeout(() => {
      if (inputEl) inputEl.focus();
    }, 100);
  },

  closeSavePlaceModal() {
    const modal = document.getElementById('save-place-modal');
    if (modal) modal.classList.remove('open');
  },

  fillSavePlaceSuggestion(text) {
    const inputEl = document.getElementById('save-place-address-input');
    if (inputEl) {
      inputEl.value = text;
      inputEl.focus();
    }
  },

  restoreSavePlaceDefaultSuggestions() {
    const suggEl = document.getElementById('save-place-suggestions');
    if (!suggEl) return;
    const slot = this._currentSavingSlot || 'Campus';
    const defaults = {
      Campus: ['OOU Main Campus Gate, Ago-Iwoye', 'OOUTH Hospital Road, Sagamu', 'Ibogun Campus, Ifo'],
      Home: ['Moboluwaduro CDA, Ifo', 'Sagamu Residential Area', '9 Goshen Ave, Idimu, Lagos', 'Egbeda, Lagos'],
      Work: ['Sagamu Campus, OOU Ijagun', 'OOUTH Admin Block, Sagamu', 'Allen Avenue, Ikeja, Lagos']
    };
    const list = defaults[slot] || defaults.Campus;
    suggEl.innerHTML = list.map(s => `
      <button type="button" style="padding:6px 12px; font-size:0.78rem; font-weight:600; background:#FAF6EB; color:#0C513F; border:1px solid #E6DEC8; border-radius:999px; cursor:pointer;" onclick="Chow45LocationPicker.fillSavePlaceSuggestion('${s.replace(/'/g, "\\'")}')">
        + ${s}
      </button>
    `).join('');
  },

  onSavePlaceInput() {
    const inputEl = document.getElementById('save-place-address-input');
    const suggEl = document.getElementById('save-place-suggestions');
    if (!inputEl || !suggEl) return;
    const q = inputEl.value.trim();

    clearTimeout(this._savePlaceSearchTimer);
    if (q.length < 2) {
      this.restoreSavePlaceDefaultSuggestions();
      return;
    }

    this._savePlaceSearchTimer = setTimeout(async () => {
      if (window.chowMap && typeof window.chowMap.searchAddress === 'function') {
        const results = await window.chowMap.searchAddress(q);
        this._savePlaceSearchResults = results || [];
        if (results && results.length > 0) {
          suggEl.innerHTML = results.map((r, idx) => `
            <button type="button" class="sugg-chip" style="width:100%; text-align:left; padding:8px 12px; margin-bottom:4px; font-size:0.82rem; font-weight:600; background:#FAF6EB; color:#0C513F; border:1px solid #E6DEC8; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px;" onclick="Chow45LocationPicker.selectSavePlaceResultByIndex(${idx})">
              <span>📍</span>
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <strong>${r.text}</strong> <small style="color:#64748B;">(${r.placeName})</small>
              </span>
            </button>
          `).join('');
        }
      }
    }, 250);
  },

  async selectSavePlaceResultByIndex(idx) {
    const result = (this._savePlaceSearchResults || [])[idx];
    if (!result) return;
    const inputEl = document.getElementById('save-place-address-input');
    if (inputEl) {
      inputEl.value = result.placeName || result.text;
    }

    let lat = result.lat;
    let lng = result.lng;

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && result.placeId) {
      if (window.chowMap && typeof window.chowMap.getPlaceDetails === 'function') {
        const details = await window.chowMap.getPlaceDetails(result.placeId);
        if (details && Number.isFinite(details.lat) && Number.isFinite(details.lng)) {
          lat = details.lat;
          lng = details.lng;
        }
      }
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      this._savePlaceCoords = { latitude: lat, longitude: lng };
    }
    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Street selected! Tap Save to confirm.', 'success');
    }
  },

  useCurrentLocationForSavePlace() {
    if (!navigator.geolocation) {
      this._networkFallbackForSavePlace();
      return;
    }
    window.chowApp && window.chowApp.toast('Locating GPS coordinates...', 'info');

    const handleSuccess = async (pos) => {
      const { latitude, longitude } = pos.coords;
      this._savePlaceCoords = { latitude, longitude };
      try {
        if (window.chowMap && typeof window.chowMap.resolveLocation === 'function') {
          const loc = await window.chowMap.resolveLocation(longitude, latitude);
          const addr = loc.formattedAddress || loc.name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          this.fillSavePlaceSuggestion(addr);
          window.chowApp && window.chowApp.toast('GPS location filled!', 'success');
        } else {
          this.fillSavePlaceSuggestion(`GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          window.chowApp && window.chowApp.toast('GPS location filled!', 'success');
        }
      } catch {
        this.fillSavePlaceSuggestion(`GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      }
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => {
        // Fallback to standard accuracy
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => {
            this._networkFallbackForSavePlace(handleSuccess);
          },
          { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
        );
      },
      { timeout: 6000, enableHighAccuracy: true, maximumAge: 10000 }
    );
  },

  async _networkFallbackForSavePlace(handleSuccess) {
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const d = await res.json();
        if (d.success !== false && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
          if (handleSuccess) {
            handleSuccess({ coords: { latitude: d.latitude, longitude: d.longitude } });
          } else {
            this._savePlaceCoords = { latitude: d.latitude, longitude: d.longitude };
            this.fillSavePlaceSuggestion(`Near ${d.city || 'Lagos'}, ${d.region || 'Nigeria'}`);
          }
          window.chowApp && window.chowApp.toast('Location filled from network connection!', 'info');
          return;
        }
      }
    } catch (e) {}
    window.chowApp && window.chowApp.toast('Could not detect GPS location. Please type manually.', 'error');
  },

  confirmSavePlace() {
    const inputEl = document.getElementById('save-place-address-input');
    const noteEl = document.getElementById('save-place-note-input');
    const address = (inputEl?.value || '').trim();
    const instructions = (noteEl?.value || '').trim();

    if (!address) {
      window.chowApp && window.chowApp.toast('Please input a delivery address or select a suggestion.', 'error');
      if (inputEl) inputEl.focus();
      return;
    }

    const slotLabel = this._currentSavingSlot || 'Campus';

    // Approximate or resolve coordinates based on address keywords or captured GPS coords
    let lat = this._savePlaceCoords ? this._savePlaceCoords.latitude : 6.8482;
    let lng = this._savePlaceCoords ? this._savePlaceCoords.longitude : 3.6545;
    let locality = 'Ago-Iwoye';
    let zoneId = 'ago-iwoye';
    let zoneName = 'Ago-Iwoye (OOU Main Campus)';

    if (!this._savePlaceCoords) {
      const lower = address.toLowerCase();
      if (lower.includes('sagamu') || lower.includes('hospital') || lower.includes('med')) {
        lat = 6.8390;
        lng = 3.6480;
        locality = 'Sagamu';
        zoneId = 'sagamu';
        zoneName = 'Sagamu (OOU Teaching Hospital)';
      } else if (lower.includes('idimu') || lower.includes('goshen')) {
        lat = 6.5742;
        lng = 3.2685;
        locality = 'Idimu';
        zoneId = 'idimu-egbeda';
        zoneName = 'Idimu & Egbeda';
      } else if (lower.includes('egbeda') || lower.includes('akowonjo')) {
        lat = 6.5910;
        lng = 3.2890;
        locality = 'Egbeda';
        zoneId = 'idimu-egbeda';
        zoneName = 'Idimu & Egbeda';
      } else if (lower.includes('ikeja') || lower.includes('allen')) {
        lat = 6.6018;
        lng = 3.3515;
        locality = 'Ikeja';
        zoneId = 'ikeja';
        zoneName = 'Ikeja';
      } else if (lower.includes('ibogun') || lower.includes('ifo')) {
        lat = 6.7200;
        lng = 3.3900;
        locality = 'Ibogun';
        zoneId = 'ago-iwoye';
        zoneName = 'OGITECH Ibogun Campus';
      }
    } else {
      if (typeof findZoneForPoint === 'function') {
        const zone = findZoneForPoint({ lng, lat });
        if (zone) {
          zoneId = zone.id;
          zoneName = zone.name;
          locality = zone.lga ? zone.lga.replace(' LGA', '') : zone.name;
        }
      }
    }
    this._savePlaceCoords = null;

    const saved = window.chowStore.state.userProfile.savedAddresses || [];
    const existingIdx = saved.findIndex(a => (a.label || '').toLowerCase() === slotLabel.toLowerCase());

    const addressRecord = {
      id: existingIdx > -1 ? saved[existingIdx].id : `addr-${Date.now()}`,
      label: slotLabel,
      name: address,
      address: address,
      formattedAddress: address,
      deliveryInstructions: instructions,
      latitude: lat,
      longitude: lng,
      lat: lat,
      lng: lng,
      locality: locality,
      zoneId: zoneId,
      zoneName: zoneName
    };

    if (existingIdx > -1) {
      saved[existingIdx] = addressRecord;
    } else {
      saved.push(addressRecord);
    }

    window.chowStore.state.userProfile.savedAddresses = saved;

    // Set as the current active delivery location
    window.chowStore.state.selectedLocation = Object.assign({}, addressRecord);
    window.chowStore.save();

    // Update location text in top nav bar
    const locTextEl = document.getElementById('current-location-text');
    if (locTextEl) {
      locTextEl.textContent = address;
    }

    // Refresh saved addresses UI in location picker
    this.renderSavedAddresses();

    // Close the save place pop-up
    this.closeSavePlaceModal();

    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast(`${slotLabel} address saved & selected!`, 'success');
    }
  },

  removeSavedAddress(label) {
    const saved = window.chowStore.state.userProfile.savedAddresses || [];
    window.chowStore.state.userProfile.savedAddresses = saved.filter(a =>
      (a.label || '').toLowerCase() !== label.toLowerCase()
    );
    window.chowStore.save();
    this.renderSavedAddresses();
    window.chowApp && window.chowApp.toast(`${label} address removed`, 'info');
  },

  removeSavedAddressByIdx(idx) {
    const saved = window.chowStore.state.userProfile.savedAddresses || [];
    const otherSaved = saved.filter(a => !['Campus', 'Home', 'Work'].some(l => l.toLowerCase() === (a.label || '').toLowerCase()));
    const target = otherSaved[idx];
    if (target) {
      window.chowStore.state.userProfile.savedAddresses = saved.filter(a => a !== target);
      window.chowStore.save();
      this.renderSavedAddresses();
      window.chowApp && window.chowApp.toast('Saved address removed', 'info');
    }
  },

  useSavedAddressByIdx(idx) {
    const saved = window.chowStore.state.userProfile.savedAddresses || [];
    const otherSaved = saved.filter(a => !['Campus', 'Home', 'Work'].some(l => l.toLowerCase() === (a.label || '').toLowerCase()));
    const target = otherSaved[idx];
    if (target) {
      const realIdx = saved.indexOf(target);
      if (realIdx > -1) this.useSavedAddress(realIdx);
    }
  },

  useSavedAddress(labelOrIdx) {
    const saved = window.chowStore.state.userProfile.savedAddresses || [];
    let addr = null;
    if (typeof labelOrIdx === 'string') {
      addr = saved.find(a => (a.label || '').toLowerCase() === labelOrIdx.toLowerCase());
    } else {
      addr = saved[labelOrIdx];
    }
    if (!addr) return;
    if (addr.latitude === undefined && addr.lng === undefined) return;

    const lng = addr.longitude ?? addr.lng;
    const lat = addr.latitude ?? addr.lat;
    this.setConfirmState('resolving');
    this.setStatus(null, 'Checking delivery availability…');

    if (addr.label) this.setLabel(addr.label);

    if (this.map && window.chowMap) window.chowMap.flyTo(this.containerId, lng, lat, 15.5);
    window.chowMap.resolveLocation(lng, lat, { timestamp: Date.now() }).then(loc => {
      loc.formattedAddress = loc.formattedAddress || addr.formattedAddress || addr.address;
      loc.address = loc.address || addr.address || addr.name;
      this.presentResolved(loc);
    });
    this.hideResults();
  },

  hideResults() {
    const container = document.getElementById('picker-search-results');
    if (container) container.className = 'picker-search-results';
    this.renderSavedAddresses();
  },

  hideSavedAddresses() {
    const container = document.getElementById('picker-saved-addresses');
    if (container) container.className = 'picker-saved-addresses hidden';
  },

  // -------------------------------------------------------------
  // WIRING
  // -------------------------------------------------------------
  bindEvents() {
    const input = document.getElementById('picker-search-input');
    if (input) input.addEventListener('input', () => this.onSearchInput());

    const gpsBtn = document.getElementById('picker-gps-btn');
    if (gpsBtn && !gpsBtn.dataset.bound) {
      gpsBtn.dataset.bound = '1';
      gpsBtn.addEventListener('click', () => this.useCurrentLocation());
    }

    const gpsFab = document.getElementById('picker-gps-fab');
    if (gpsFab && !gpsFab.dataset.bound) {
      gpsFab.dataset.bound = '1';
      gpsFab.addEventListener('click', () => this.useCurrentLocation());
    }

    const savePlaceInput = document.getElementById('save-place-address-input');
    if (savePlaceInput && !savePlaceInput.dataset.bound) {
      savePlaceInput.dataset.bound = '1';
      savePlaceInput.addEventListener('input', () => this.onSavePlaceInput());
    }

    const searchAreaBtn = document.getElementById('picker-search-area-btn');
    if (searchAreaBtn && !searchAreaBtn.dataset.bound) {
      searchAreaBtn.dataset.bound = '1';
      searchAreaBtn.addEventListener('click', () => {
        const c = window.chowMap.getCenter(this.containerId);
        if (c) {
          this.setStatus(null, 'Checking delivery availability…');
          const lng = typeof c.lng === 'function' ? c.lng() : (c.lng ?? (Array.isArray(c) ? c[0] : c.longitude));
          const lat = typeof c.lat === 'function' ? c.lat() : (c.lat ?? (Array.isArray(c) ? c[1] : c.latitude));
          const numLng = Number(lng) || 3.6545;
          const numLat = Number(lat) || 6.8482;
          this.resolveAndPresent({ lng: numLng, lat: numLat, accuracy: null, timestamp: Date.now() });
        } else {
          this.onPinMoved();
        }
      });
    }

    const backBtn = document.getElementById('picker-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.close());

    const confirmBtn = document.getElementById('picker-confirm-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', () => this.confirmLocation());
    const headerConfirmBtn = document.getElementById('picker-header-confirm-btn');
    if (headerConfirmBtn) headerConfirmBtn.addEventListener('click', () => this.confirmLocation());

    const modal = document.getElementById('map-picker-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const saveModal = document.getElementById('save-place-modal');
        if (saveModal && saveModal.classList.contains('open')) {
          this.closeSavePlaceModal();
          return;
        }
        const pickerModal = document.getElementById('map-picker-modal');
        if (pickerModal && pickerModal.classList.contains('open')) {
          this.close();
        }
      }
    });
  }
};

window.Chow45LocationPicker = Chow45LocationPicker;
window.chowLocationPicker = Chow45LocationPicker;

document.addEventListener('DOMContentLoaded', () => {
  Chow45LocationPicker.bindEvents();
});