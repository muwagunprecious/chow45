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

  open(opts) {
    const modal = document.getElementById('map-picker-modal');
    if (!modal) return;

    this.onConfirmCallback = (opts && opts.onConfirm) || null;
    this.mode = (opts && opts.mode) || 'delivery'; // 'delivery' | 'pickup'

    const saved = window.chowStore.state.selectedLocation;
    const initial = {
      lng: saved.lng ?? (saved.longitude ?? 3.6545),
      lat: saved.lat ?? (saved.latitude ?? 6.8482)
    };

    this.currentLocation = null;
    this.hideResults();
    this.renderSavedAddresses();

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    this.clearStatus();
    this.setConfirmState('resolving');

    setTimeout(() => this.bootMap(initial), 60);
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
      zoom: 14.5,
      onLoad: () => {
        this.onPinMoved();
      },
      onMoveSettled: () => this.onPinMoved()
    });

    if (this.map) {
      window.chowMap.renderServiceZones(this.containerId);
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
  // GPS
  // -------------------------------------------------------------
  useCurrentLocation() {
    if (!navigator.geolocation) {
      this.setGpsError('Your browser does not support location services.', 'Search manually');
      return;
    }

    this.setStatus(null, 'Locating you…');
    this.setConfirmState('resolving');

    navigator.geolocation.getCurrentPosition(
      (position) => this.onGpsSuccess(position),
      (err) => this.onGpsError(err),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  },

  onGpsSuccess(position) {
    const { latitude, longitude, accuracy } = position.coords;

    if (typeof accuracy === 'number' && accuracy > 450) {
      // Poor accuracy: don't block, but clearly warn and grant manual options.
      this.setStatus('warning', 'Your location isn’t precise enough.');
      this.setConfirmState('blocked');
      const banner = document.getElementById('picker-status-banner');
      if (banner) {
        banner.className = 'picker-status-banner warning open';
        banner.innerHTML = `
          <div>
            <strong>Your location isn't precise enough.</strong>
            <p>GPS accuracy is ${Math.round(accuracy)} m. Try again or move the map pin to your delivery spot.</p>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="picker-chip-btn" onclick="Chow45LocationPicker.useCurrentLocation()">Retry GPS</button>
            <button class="picker-chip-btn" onclick="document.getElementById('picker-search-input').focus()">Search manually</button>
          </div>
        `;
      }
      return;
    }

    this.setStatus(null, 'Checking delivery availability…');
    this.setConfirmState('resolving');

    if (this.map && window.chowMap) {
      window.chowMap.flyTo(this.containerId, longitude, latitude, 15.5);
      window.chowMap.showAccuracyCircle(this.map, { lng: longitude, lat: latitude }, accuracy);
    }

    window.chowMap.resolveLocation(longitude, latitude, { accuracy, timestamp: Date.now() })
      .then((loc) => this.presentResolved(loc));
  },

  onGpsError(err) {
    const code = err && err.code;
    if (code === 1) {
      this.setGpsError('Location access was denied.', 'Search manually');
    } else if (code === 3) {
      this.setGpsError('We couldn’t get your location.', 'Try again');
    } else {
      this.setGpsError('We couldn’t get your location.', 'Try again');
    }
  },

  setGpsError(message, action) {
    this.setStatus('error', message);
    this.setConfirmState('blocked');
    const banner = document.getElementById('picker-status-banner');
    if (banner) {
      const click = action === 'Try again'
        ? `Chow45LocationPicker.useCurrentLocation()`
        : `document.getElementById('picker-search-input').focus()`;
      banner.className = 'picker-status-banner error open';
      banner.innerHTML = `
        <div>
          <strong>${message}</strong>
          <p>You can also search for your delivery address manually.</p>
        </div>
        <button class="picker-chip-btn" onclick="${click}">${action}</button>
      `;
    }
  },

  // -------------------------------------------------------------
  // MOVABLE PIN (map pans, pin stays centered)
  // -------------------------------------------------------------
  onPinMoved() {
    const map = window.chowMap && window.chowMap.getMap(this.containerId);
    if (!map) return;
    if (this.resolving) return;

    this.setConfirmState('resolving');
    this.setStatus(null, 'Checking delivery availability…');

    const c = map.getCenter();
    this.resolveAndPresent({ lng: c.lng, lat: c.lat, accuracy: null, timestamp: Date.now() }, true);
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

    this.searchTimer = setTimeout(async () => {
      const results = await window.chowMap.searchAddress(q);
      this.renderResults(results);
    }, CHOW45_MAPBOX_CONFIG.searchDebounceMs);
  },

  renderResults(results) {
    const container = document.getElementById('picker-search-results');
    if (!container) return;
    this.hideSavedAddresses();

    if (!results || results.length === 0) {
      container.className = 'picker-search-results open';
      container.innerHTML = `
        <div class="picker-search-empty">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>We couldn't find that. Try “Olori Market”, “OOU Main Gate”, “Sagamu”.</span>
        </div>`;
      return;
    }

    container.className = 'picker-search-results open';
    container.innerHTML = results.map(r => `
      <button class="picker-result-item" onclick="Chow45LocationPicker.selectResult(${JSON.stringify(r).replace(/"/g, '&quot;')})">
        <span class="picker-result-icon">📍</span>
        <span>
          <strong>${r.text}</strong>
          <small>${r.placeName}</small>
        </span>
      </button>
    `).join('');
  },

  selectResult(result) {
    this.currentLocation = null;
    this.setConfirmState('resolving');
    this.setStatus(null, 'Checking delivery availability…');

    if (this.map && window.chowMap) window.chowMap.flyTo(this.containerId, result.lng, result.lat, 15.5);

    window.chowMap.resolveLocation(result.lng, result.lat, { timestamp: Date.now() })
      .then((loc) => {
        loc.placeId = result.placeId;
        loc.address = loc.address || result.text;
        loc.formattedAddress = loc.formattedAddress || result.placeName;
        this.presentResolved(loc);
      });

    const input = document.getElementById('picker-search-input');
    if (input) input.value = result.text;
    this.hideResults();
  },

  // -------------------------------------------------------------
  // RESOLUTION & AVAILABILITY PRESENTATION
  // -------------------------------------------------------------
  async resolveAndPresent(point) {
    this.resolving = true;
    try {
      const loc = await window.chowMap.resolveLocation(point.lng, point.lat, {
        accuracy: point.accuracy,
        timestamp: point.timestamp
      });
      this.presentResolved(loc);
    } catch (e) {
      this.setConfirmState('blocked');
      this.setStatus('error', 'We couldn’t identify this location.');
    } finally {
      this.resolving = false;
    }
  },

  presentResolved(loc) {
    this.currentLocation = loc;
    window.chowMap.removeAccuracyCircle(this.map);

    const addressText = document.getElementById('picker-address-text');
    if (addressText) {
      addressText.innerHTML = `
        <strong>${this._titleFromAddress(loc)}</strong>
        <span>${this._subtitleFromAddress(loc)}</span>
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

    const availability = loc.availability || getServiceAvailability({ lng: loc.longitude, lat: loc.latitude });
    loc.availability = availability;

    if (availability.status === 'available') {
      this.setStatus('success', 'Chow45 delivers here.');
      this.setConfirmState('ready');
      if (statusEl) {
        statusEl.className = 'picker-zone-status ok';
        statusEl.innerHTML = `<span>✓</span> ${availability.zone ? availability.zone.name : 'Delivery zone'}`;
      }
      if (banner) {
        banner.className = 'picker-status-banner success open';
        banner.innerHTML = `
          <div>
            <strong>Great! We deliver here.</strong>
            <p>${availability.zone ? availability.zone.name + ' • ' : ''}${loc.lga ? loc.lga + ', ' : ''}Ogun State</p>
          </div>`;
      }
    } else if (availability.status === 'ogun_outside_zone') {
      this.setConfirmState('waitlist');
      if (statusEl) {
        statusEl.className = 'picker-zone-status warn';
        statusEl.innerHTML = `<span>⚠</span> Expanding to ${loc.state || 'Ogun State'} soon`;
      }
      if (banner) {
        banner.className = 'picker-status-banner warning open';
        banner.innerHTML = `
          <div>
            <strong>You're in Ogun State, but Chow45 hasn't reached this area yet.</strong>
            <p>We're currently expanding across Ogun State. Join the waitlist to be first in line.</p>
          </div>
          <button class="picker-chip-btn" onclick="Chow45LocationPicker.joinWaitlist()">Join the waitlist</button>
        `;
      }
    } else {
      this.setConfirmState('blocked');
      if (statusEl) {
        statusEl.className = 'picker-zone-status err';
        statusEl.innerHTML = `<span>✕</span> Outside service area`;
      }
      if (banner) {
        banner.className = 'picker-status-banner error open';
        banner.innerHTML = `
          <div>
            <strong>Chow45 isn't available here yet.</strong>
            <p>We're currently expanding across Ogun State.</p>
          </div>
          <button class="picker-chip-btn" onclick="Chow45LocationPicker.open()">Choose another location</button>
        `;
      }
    }

    this.renderConfirmCard();
  },

  _titleFromAddress(loc) {
    const parts = [loc.street || loc.address, loc.locality, loc.place].filter(Boolean);
    return parts[0] || loc.formattedAddress || 'Selected location';
  },

  _subtitleFromAddress(loc) {
    const parts = [loc.lga, loc.state ? loc.state + ' State' : '', loc.country].filter(Boolean);
    const l = [loc.locality, loc.place].filter(Boolean);
    const joined = l.length ? l.join(', ') + (parts.length ? ', ' + parts.join(', ') : '') : parts.join(', ');
    return joined || loc.formattedAddress || 'Ogun State, Nigeria';
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
    const btn = document.getElementById('picker-confirm-btn');
    const card = document.getElementById('picker-confirm-card');
    if (!btn) return;
    btn.dataset.state = state;
    btn.disabled = state === 'resolving' || state === 'blocked';

    if (state === 'ready') {
      btn.className = 'cta-primary-btn picker-confirm-btn';
      btn.innerHTML = `Confirm location`;
    } else if (state === 'waitlist') {
      btn.className = 'cta-primary-btn picker-confirm-btn picker-btn-secondary';
      btn.innerHTML = `Join the waitlist`;
    } else if (state === 'resolving') {
      btn.className = 'cta-primary-btn picker-confirm-btn';
      btn.innerHTML = `Checking delivery availability…`;
    } else {
      btn.className = 'cta-primary-btn picker-confirm-btn';
      btn.innerHTML = `Choose a delivery location`;
    }
    if (card) card.classList.toggle('blocked', state === 'blocked');
  },

  renderConfirmCard() {
    const labelOutput = document.getElementById('picker-address-label-output');
    const selectedLabel = this.getSelectedLabel();
    if (labelOutput) labelOutput.innerText = selectedLabel ? selectedLabel : 'Deliver to';
  },

  getSelectedLabel() {
    return Array.from(document.querySelectorAll('.picker-label-chip.active')).map(c => c.dataset.label)[0] || '';
  },

  setLabel(label) {
    document.querySelectorAll('.picker-label-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.label === label);
    });
    this.renderConfirmCard();
  },

  async confirmLocation() {
    const loc = this.currentLocation;
    if (!loc) return;
    const isPickup = this.mode === 'pickup';

    if (!isPickup) {
      const availability = loc.availability || getServiceAvailability({ lng: loc.longitude, lat: loc.latitude });
      if (availability.status === 'ogun_outside_zone') {
        this.joinWaitlist();
        return;
      }
      if (availability.status !== 'available') {
        window.chowApp && window.chowApp.toast('Please choose a location where Chow45 delivers.', 'warning');
        return;
      }
    }

    const instructions = document.getElementById('picker-instructions-input');
    const label = isPickup ? 'Store Pickup' : (this.getSelectedLabel() || 'Home');

    const payload = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      timestamp: loc.timestamp,
      address: loc.address,
      locality: loc.locality,
      lga: loc.lga,
      state: loc.state || 'Ogun',
      country: loc.country,
      placeId: loc.placeId,
      formattedAddress: loc.formattedAddress,
      zoneId: loc.availability && loc.availability.zone ? loc.availability.zone.id : null,
      zoneName: loc.availability && loc.availability.zone ? loc.availability.zone.name : null,
      deliveryInstructions: instructions ? instructions.value.trim() : '',
      label: label
    };

    if (!isPickup) {
      window.chowStore.setDeliveryLocation(payload);
    }

    this.close();
    window.chowApp && window.chowApp.toast(isPickup ? 'Pickup address confirmed ✓' : 'Delivery location confirmed ✓', 'success');
    if (typeof this.onConfirmCallback === 'function') {
      const cb = this.onConfirmCallback;
      this.onConfirmCallback = null;
      cb(payload);
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

  useCurrentLocationForSavePlace() {
    if (!navigator.geolocation) {
      window.chowApp && window.chowApp.toast('Location services not supported on this device.', 'error');
      return;
    }
    window.chowApp && window.chowApp.toast('Locating GPS coordinates...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
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
      },
      () => {
        window.chowApp && window.chowApp.toast('Could not detect GPS location. Please type manually.', 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
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

    // Approximate or resolve coordinates based on address keywords
    let lat = 6.8482;
    let lng = 3.6545;
    let locality = 'Ago-Iwoye';
    let zoneId = 'ago-iwoye';
    let zoneName = 'Ago-Iwoye (OOU Main Campus)';

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

    const searchAreaBtn = document.getElementById('picker-search-area-btn');
    if (searchAreaBtn && !searchAreaBtn.dataset.bound) {
      searchAreaBtn.dataset.bound = '1';
      searchAreaBtn.addEventListener('click', () => {
        const c = window.chowMap.getCenter(this.containerId);
        if (c) {
          this.setStatus(null, 'Checking delivery availability…');
          this.resolveAndPresent(c);
        } else {
          this.onPinMoved();
        }
      });
    }

    const backBtn = document.getElementById('picker-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.close());

    const confirmBtn = document.getElementById('picker-confirm-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', () => this.confirmLocation());

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