/**
 * CHOW45 MAIN APPLICATION BOOTSTRAPPER
 * Manages role navigation, global toast notifications, location modal, and lifecycle
 */

const Chow45App = {
  init() {
    // Guard against a second boot. The scripts can be loaded both by the
    // static shell and by the React view, and Fast Refresh can re-run either
    // one, which used to double-bind global handlers.
    if (window._chow45Initialized) return;
    window._chow45Initialized = true;

    console.log('🚀 Initializing Chow45 Food Delivery Marketplace');

    // Initialize auth first so user profile & role session are restored before controllers boot
    if (typeof Chow45Auth !== 'undefined') {
      Chow45Auth.init();
    }

    // Initialize all controllers with restored session in place
    CustomerController.init();
    VendorController.init();
    RiderController.init();
    AdminController.init();

    this.bindGlobalEvents();

    // Check URL pathname or parameters for direct role jumping (e.g. /vendor/food or /app?role=vendor)
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    let initialRole = urlParams.get('role');

    if (pathname.startsWith('/vendor')) {
      if (
        typeof Chow45Auth !== 'undefined' &&
        typeof Chow45Auth.isLoggedIn === 'function' &&
        Chow45Auth.isLoggedIn() &&
        typeof Chow45Auth.isVendorUser === 'function' &&
        !Chow45Auth.isVendorUser()
      ) {
        console.warn('[chow45] Logged-in non-vendor attempted to access /vendor. Redirecting to /app.');
        window.location.replace('/app?notice=not_a_vendor');
        return;
      }
      initialRole = 'vendor';
    } else if (pathname === '/app' || pathname === '/') {
      // On marketplace route, if no ?role= is provided, ensure customer role
      if (!initialRole) {
        initialRole = 'customer';
        if (window.chowStore && window.chowStore.state) {
          window.chowStore.state.currentRole = 'customer';
          window.chowStore.save();
        }
      }
    }

    if (
      initialRole === 'vendor' &&
      typeof Chow45Auth !== 'undefined' &&
      typeof Chow45Auth.isLoggedIn === 'function' &&
      Chow45Auth.isLoggedIn() &&
      typeof Chow45Auth.isVendorUser === 'function' &&
      !Chow45Auth.isVendorUser()
    ) {
      console.warn('[chow45] Logged-in non-vendor attempted to switch to vendor role via query param.');
      initialRole = 'customer';
      if (window.chowStore && window.chowStore.state) {
        window.chowStore.state.currentRole = 'customer';
        window.chowStore.save();
      }
      window.location.replace('/app?notice=not_a_vendor');
      return;
    }

    const isNonVendorUser = typeof Chow45Auth !== 'undefined' &&
      typeof Chow45Auth.isLoggedIn === 'function' &&
      Chow45Auth.isLoggedIn() &&
      typeof Chow45Auth.isVendorUser === 'function' &&
      !Chow45Auth.isVendorUser();

    const isVendorContext = !isNonVendorUser && (
      pathname.startsWith('/vendor') ||
      initialRole === 'vendor' ||
      (pathname !== '/app' && window.chowStore?.state?.currentRole === 'vendor') ||
      sessionStorage.getItem('chow45_vendor_trigger_setup') === 'true'
    );

    // Pull the vendor's real profile from the server whenever in vendor context
    if (isVendorContext && typeof Chow45Auth !== 'undefined') {
      Chow45Auth.loadVendorProfile();
      if (typeof Chow45Auth.checkFirstTimeVendorSetup === 'function') {
        Chow45Auth.checkFirstTimeVendorSetup();
      }
    }

    this.updateRoleUI(window.chowStore.state.currentRole);
    this.updateLocationUI(window.chowStore.state.selectedLocation);

    if (initialRole && ['customer', 'vendor', 'rider', 'admin'].includes(initialRole)) {
      if (
        initialRole === 'vendor' &&
        typeof Chow45Auth !== 'undefined' &&
        typeof Chow45Auth.isLoggedIn === 'function' &&
        Chow45Auth.isLoggedIn() &&
        typeof Chow45Auth.isVendorUser === 'function' &&
        !Chow45Auth.isVendorUser()
      ) {
        window.location.href = '/app?notice=not_a_vendor';
        return;
      }
      this.switchRole(initialRole);
    } else {
      this.updateRoleUI(window.chowStore.state.currentRole || 'customer');
    }

    if (pathname.includes('/food') || urlParams.get('tab') === 'food') {
      if (typeof VendorController !== 'undefined' && VendorController.switchSubTab) {
        VendorController.switchSubTab('food');
      }
    }

    // Runs after Chow45Auth.init() has restored the session, so returning
    // vendors are not asked to onboard again.
    if (typeof VendorOnboarding !== 'undefined') {
      VendorOnboarding.init();
    }

    // Pull real vendor stores and menu items from Postgres database
    this.syncFromServer();

    // Check if campus is selected; if not, immediately pop up campus & location prompt
    this.checkCampusSelectionPrompt();
  },

  async syncFromServer() {
    try {
      const isVendor = (typeof VendorController !== 'undefined' && VendorController.isVendorContext && VendorController.isVendorContext());
      const ident = (isVendor && typeof VendorController._resolveVendorIdentity === 'function')
        ? VendorController._resolveVendorIdentity()
        : null;
      const headers = { 'Content-Type': 'application/json' };
      if (ident?.storeId) headers['x-vendor-store-id'] = String(ident.storeId);
      if (ident?.vendorId) headers['x-vendor-id'] = String(ident.vendorId);
      if (ident?.email) headers['x-vendor-email'] = String(ident.email);

      const res = await fetch('/api/bootstrap', { headers, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.stores)) {
        window.chowStore.state.restaurants = data.stores;
        if (data.favorites) {
          if (!window.chowStore.state.userProfile) window.chowStore.state.userProfile = {};
          window.chowStore.state.userProfile.favorites = data.favorites;
        }
        window.chowStore.save();
        if (typeof CustomerController !== 'undefined') {
          CustomerController.isLoading = false;
          CustomerController.isInitialLoaded = true;
          if (CustomerController.render) {
            CustomerController.render();
          }
        }
        if (isVendor && typeof VendorController !== 'undefined') {
          if (VendorController.render) VendorController.render();
          if (VendorController.syncMenuFromServer) VendorController.syncMenuFromServer();
        }
      }

      if (Array.isArray(data.orders) && window.chowStore && window.chowStore.state) {
        window.chowStore.state.orders = data.orders;
        window.chowStore.save();
      }

      if (data.signedIn && data.user) {
        const u = data.user;
        const role = data.role === 'VENDOR' ? 'vendor' : (u.role === 'VENDOR' ? 'vendor' : 'customer');
        const profile = {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          image: u.image || '',
          avatar: u.image || '',
          role: role,
          isLoggedIn: true
        };


        if (role === 'vendor' && Array.isArray(data.stores)) {
          const myStore = data.stores.find(s => 
            (s.userId && String(s.userId) === String(u.id)) ||
            (s.numericId && String(s.numericId) === String(u.vendorId || u.id)) ||
            (s.email && s.email.toLowerCase() === u.email.toLowerCase()) ||
            (s.contactEmail && s.contactEmail.toLowerCase() === u.email.toLowerCase())
          );
          if (myStore) {
            profile.storeId = myStore.id;
            profile.vendorId = myStore.numericId;
            profile.name = myStore.name || profile.name;
          }
        }
        if (window.chowStore && window.chowStore.state) {
          if (typeof window.chowStore.ensureUserProfileIntegrity === 'function') {
            window.chowStore.ensureUserProfileIntegrity();
          }
          window.chowStore.state.userProfile = Object.assign(
            {},
            window.chowStore.state.userProfile || {},
            profile
          );
          if (typeof window.chowStore.ensureUserProfileIntegrity === 'function') {
            window.chowStore.ensureUserProfileIntegrity();
          }
          window.chowStore.save();
        }
        if (typeof Chow45Auth !== 'undefined') {
          const session = {
            token: 'chow45_session_' + Date.now(),
            user: profile,
            createdAt: new Date().toISOString()
          };
          localStorage.setItem(Chow45Auth.STORAGE_KEY, JSON.stringify(session));
          Chow45Auth.updateUI();
        }

        if (role === 'vendor' && window.location.pathname.startsWith('/vendor')) {
          if (typeof VendorController !== 'undefined') {
            if (VendorController.render) VendorController.render();
            if (VendorController.syncMenuFromServer) VendorController.syncMenuFromServer();
          }
        }
      }
    } catch (err) {
      console.warn('[chow45] could not sync from bootstrap:', err);
    }
  },

  bindGlobalEvents() {
    // Listen for store role changes
    window.chowStore.subscribe((state) => {
      this.updateRoleUI(state.currentRole);
      this.updateLocationUI(state.selectedLocation);
    });

    // Close modals on backdrop click (strictly ignoring mandatory vendor password change modal)
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal.id === 'vendor-first-setup-modal') {
            // Strictly mandatory; backdrop clicks cannot dismiss
            return;
          }
          if (modal.id === 'campus-prompt-modal') {
            if (!Chow45App._modalDismissible && !window.chowStore?.state?.selectedCampus) {
              return;
            }
          }
          modal.classList.remove('open');
        }
      });
    });

    // Close campus autocomplete dropdown on outside click
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('campus-autocomplete-dropdown');
      const input = document.getElementById('campus-address-input');
      if (dropdown && dropdown.style.display !== 'none') {
        if (!dropdown.contains(e.target) && e.target !== input) {
          dropdown.style.display = 'none';
        }
      }
    });
  },

  switchRole(roleName) {
    if (roleName === 'vendor') {
      if (
        typeof Chow45Auth !== 'undefined' &&
        typeof Chow45Auth.isLoggedIn === 'function' &&
        Chow45Auth.isLoggedIn() &&
        typeof Chow45Auth.isVendorUser === 'function' &&
        !Chow45Auth.isVendorUser()
      ) {
        console.warn('[chow45] Logged-in non-vendor attempted to switch to vendor role. Redirecting.');
        window.location.href = '/app?notice=not_a_vendor';
        return;
      }
    }
    if (window.chowStore && window.chowStore.setRole) {
      window.chowStore.setRole(roleName);
    }
    this.updateRoleUI(roleName);
    if (roleName === 'vendor') {
      if (typeof Chow45Auth !== 'undefined') {
        Chow45Auth.loadVendorProfile();
      }
      if (typeof VendorController !== 'undefined') {
        if (VendorController.render) VendorController.render();
        if (VendorController.syncMenuFromServer) VendorController.syncMenuFromServer();
      }
    }
  },

  updateRoleUI(role) {
    if (!role) role = 'customer';

    // Update role bar buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });

    // Show only the navigation that belongs to the active role, so a vendor
    // never sees the customer Discover/Orders/Cart bar.
    document.querySelectorAll('[data-nav-for]').forEach(nav => {
      nav.hidden = nav.dataset.navFor !== role;
    });

    // Update bottom navigation tabs
    if (role === 'customer') {
      const activeTab = document.querySelector('.bottom-nav[data-nav-for="customer"] .bottom-tab.active');
      if (!activeTab) {
        const discoverTab = document.querySelector('.bottom-nav[data-nav-for="customer"] .bottom-tab[data-tab="discover"]');
        if (discoverTab) discoverTab.classList.add('active');
      }
    } else {
      document.querySelectorAll(`.bottom-nav[data-nav-for="${role}"] .bottom-tab`).forEach(tab => {
        if (tab.dataset.role) tab.classList.toggle('active', tab.dataset.role === role);
      });
    }

    // Vendor bars highlight the sub-tab that is currently open.
    const activeSubTab = (window.VendorController && window.VendorController.activeSubTab) || 'food';
    document.querySelectorAll('[data-vendor-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vendorTab === activeSubTab);
    });

    // Toggle role viewport panels
    document.querySelectorAll('.role-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${role}`);
    });

    // Trigger map resize if customer role tracking is active
    if (role === 'customer' && window.chowMap) {
      window.chowMap.resize();
    }
  },

  // -------------------------------------------------------------
  // Campus & Delivery Location Modal
  // -------------------------------------------------------------
  _modalCampus: null,
  _modalDismissible: true,
  _modalSelectedLat: null,
  _modalSelectedLng: null,
  _detectedGps: null,
  _autocompleteTimer: null,

  CAMPUS_CONFIG: {
    sagamu: {
      name: 'Sagamu Campus',
      tag: 'Verified Kitchens',
      badge: '🏥 Sagamu Campus',
      centerLat: 6.8400,
      centerLng: 3.6500,
      placeholder: 'e.g. Clinical Hostel, OSUTH Gate, Room 14',
      presets: [
        { name: 'OSUTH Gate', lat: 6.8400, lng: 3.6500 },
        { name: 'Clinical Hostel', lat: 6.8420, lng: 3.6480 },
        { name: 'Hospital Road', lat: 6.8390, lng: 3.6520 },
        { name: 'OOU Med Campus', lat: 6.8410, lng: 3.6510 },
        { name: 'Ewusi Street', lat: 6.8450, lng: 3.6470 },
        { name: 'Sabo Sagamu', lat: 6.8350, lng: 3.6550 }
      ],
      landmarks: [
        { name: 'Clinical Hostel', sub: 'OOU Medical Campus, Sagamu', lat: 6.8420, lng: 3.6480 },
        { name: 'OSUTH Main Gate', sub: 'OOU Teaching Hospital, Hospital Rd', lat: 6.8400, lng: 3.6500 },
        { name: 'Hospital Road', sub: 'Sagamu, Ogun State', lat: 6.8390, lng: 3.6520 },
        { name: 'OOU Medical Campus', sub: 'Faculty of Clinical Sciences', lat: 6.8410, lng: 3.6510 },
        { name: 'Ewusi Street', sub: 'Makun, Sagamu', lat: 6.8450, lng: 3.6470 },
        { name: 'Sabo Market', sub: 'Sabo, Sagamu', lat: 6.8350, lng: 3.6550 },
        { name: 'GRA Sagamu', sub: 'Government Reserved Area, Sagamu', lat: 6.8480, lng: 3.6420 },
        { name: 'Pre-Clinical Hall', sub: 'OOU Sagamu Campus', lat: 6.8415, lng: 3.6495 },
        { name: 'Remo High School Road', sub: 'Sagamu, Ogun State', lat: 6.8370, lng: 3.6510 }
      ]
    },
    ibogun: {
      name: 'Ibogun Campus',
      tag: 'OGITECH / Ibogun',
      badge: '🏫 Ibogun Campus',
      centerLat: 6.7200,
      centerLng: 3.3900,
      placeholder: 'e.g. OGITECH Main Gate, Student Village, Room 3',
      presets: [
        { name: 'OGITECH Main Gate', lat: 6.7210, lng: 3.3910 },
        { name: 'Student Village', lat: 6.7230, lng: 3.3890 },
        { name: 'Campus Hostels', lat: 6.7200, lng: 3.3920 },
        { name: 'Ibogun Market Road', lat: 6.7190, lng: 3.3940 },
        { name: 'OOU Ibogun Gate', lat: 6.7220, lng: 3.3900 }
      ],
      landmarks: [
        { name: 'OGITECH Main Gate', sub: 'Ogun State Institute of Technology, Ibogun', lat: 6.7210, lng: 3.3910 },
        { name: 'Student Village', sub: 'Student Village Hostels, Ibogun', lat: 6.7230, lng: 3.3890 },
        { name: 'OOU Ibogun Campus Gate', sub: 'College of Engineering & Tech, Ibogun', lat: 6.7220, lng: 3.3900 },
        { name: 'Campus Hostels', sub: 'Ibogun Campus Residential Lodges', lat: 6.7200, lng: 3.3920 },
        { name: 'Ibogun Market Road', sub: 'Ibogun Town, Ogun State', lat: 6.7190, lng: 3.3940 },
        { name: 'Engineering Workshop Hall', sub: 'OOU Ibogun Campus', lat: 6.7215, lng: 3.3905 }
      ]
    }
  },

  checkCampusSelectionPrompt() {
    const isVendor = typeof VendorController !== 'undefined' && VendorController.isVendorContext && VendorController.isVendorContext();
    const isRider = window.location.pathname.startsWith('/rider');
    const isAdmin = window.location.pathname.startsWith('/admin');
    if (isVendor || isRider || isAdmin) return;

    const savedCampus = window.chowStore?.state?.selectedCampus || localStorage.getItem('chow45_selected_campus');
    if (!savedCampus) {
      setTimeout(() => {
        this.openCampusModal(false);
      }, 120);
    }
  },

  openCampusModal(dismissible = true) {
    this._modalDismissible = dismissible;
    const modal = document.getElementById('campus-prompt-modal');
    if (!modal) {
      this.openLocationModal();
      return;
    }

    const closeBtn = document.getElementById('campus-modal-close-btn');
    if (closeBtn) {
      closeBtn.style.display = dismissible ? 'inline-flex' : 'none';
    }

    const currentCampus = window.chowStore?.state?.selectedCampus || localStorage.getItem('chow45_selected_campus');
    this._modalCampus = currentCampus || 'sagamu';

    // Show step 1 by default
    this.showCampusStep(1);
    modal.classList.add('open');
  },

  closeCampusModal() {
    if (!this._modalDismissible && !window.chowStore?.state?.selectedCampus) {
      this.toast('Please select your campus to explore food vendors', 'info');
      return;
    }
    const modal = document.getElementById('campus-prompt-modal');
    if (modal) modal.classList.remove('open');
    this.hideCampusAutocomplete();
  },

  showCampusStep(step) {
    const step1 = document.getElementById('campus-modal-step-1');
    const step2 = document.getElementById('campus-modal-step-2');
    const err = document.getElementById('campus-modal-error');
    if (err) err.style.display = 'none';
    this.hideCampusAutocomplete();

    if (step === 1) {
      if (step1) step1.style.display = 'block';
      if (step2) step2.style.display = 'none';
    } else {
      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';
    }
  },

  chooseCampusStep(campus) {
    if (campus !== 'sagamu' && campus !== 'ibogun') campus = 'sagamu';
    this._modalCampus = campus;

    const config = this.CAMPUS_CONFIG[campus] || this.CAMPUS_CONFIG.sagamu;
    this._modalSelectedLat = config.centerLat;
    this._modalSelectedLng = config.centerLng;
    this._detectedGps = null;

    // Reset GPS card
    const gpsCard = document.getElementById('campus-gps-confirm-card');
    if (gpsCard) gpsCard.style.display = 'none';

    const badge = document.getElementById('campus-modal-badge');
    if (badge) {
      badge.textContent = config.name;
      badge.style.background = campus === 'ibogun' ? '#DBEAFE' : '#E8F8EE';
      badge.style.color = campus === 'ibogun' ? '#1E40AF' : '#008704';
    }

    const title = document.getElementById('campus-step-2-title');
    if (title) {
      title.textContent = `Where should we deliver in ${campus === 'ibogun' ? 'Ibogun' : 'Sagamu'}?`;
    }

    const sub = document.getElementById('campus-step-2-sub');
    if (sub) {
      sub.textContent = campus === 'ibogun'
        ? 'Enter your room, hostel, or spot around OGITECH & Ibogun.'
        : 'Enter your hostel, room, hall, or address in Sagamu.';
    }

    const input = document.getElementById('campus-address-input');
    if (input) {
      input.placeholder = config.placeholder;
      const currentLoc = window.chowStore?.state?.selectedLocation;
      if (currentLoc && currentLoc.address && (window.chowStore?.state?.selectedCampus === campus)) {
        input.value = currentLoc.address;
      } else {
        input.value = '';
      }
    }

    const presetsContainer = document.getElementById('campus-presets-container');
    if (presetsContainer) {
      presetsContainer.innerHTML = config.presets.map(p => `
        <button type="button" class="campus-preset-chip"
          onclick="Chow45App.setCampusPreset('${p.name.replace(/'/g, "\\'")}', ${p.lat}, ${p.lng})"
          style="padding: 6px 12px; border-radius: 999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #334155; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease;">
          ${p.name}
        </button>
      `).join('');
    }

    const err = document.getElementById('campus-modal-error');
    if (err) err.style.display = 'none';

    this.showCampusStep(2);
    setTimeout(() => {
      input?.focus();
    }, 150);
  },

  setCampusPreset(name, lat, lng) {
    const input = document.getElementById('campus-address-input');
    if (input) input.value = name;
    this._modalSelectedLat = lat;
    this._modalSelectedLng = lng;

    const err = document.getElementById('campus-modal-error');
    if (err) err.style.display = 'none';
    this.hideCampusAutocomplete();

    // Highlight selected chip
    document.querySelectorAll('.campus-preset-chip').forEach(btn => {
      const isMatch = btn.textContent.trim() === name.trim();
      btn.style.borderColor = isMatch ? '#00a205' : '#CBD5E1';
      btn.style.background = isMatch ? '#E8F8EE' : '#F8FAFC';
      btn.style.color = isMatch ? '#008704' : '#334155';
    });
  },

  // -------------------------------------------------------------
  // Live GPS Geolocation with Google Maps Reverse Geocode
  // -------------------------------------------------------------
  useLiveLocationForCampusModal() {
    const btn = document.getElementById('campus-modal-gps-btn');
    const err = document.getElementById('campus-modal-error');
    if (err) err.style.display = 'none';

    if (!navigator.geolocation) {
      if (err) {
        err.innerHTML = '📡 Geolocation is not supported by your browser. Please type your hostel or address below.';
        err.style.display = 'block';
      }
      return;
    }

    const originalText = '📍 Detect My Street via Google Maps';
    if (btn) {
      btn.innerHTML = '⏳ Getting your GPS coordinates...';
      btn.disabled = true;
    }

    const onCoordsSuccess = async (lat, lng) => {
      if (btn) btn.innerHTML = '⏳ Checking street on Google Maps...';
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          const campus = Chow45App._modalCampus || 'sagamu';
          const campusLabel = campus === 'ibogun' ? 'Ibogun' : 'Sagamu';
          const street = data.street || (data.address ? data.address.split(',')[0] : `Detected Location (${campusLabel})`);
          const fullAddress = data.address || `${street}, ${campusLabel}, Ogun State`;

          Chow45App._detectedGps = { lat, lng, street, fullAddress };
          Chow45App._modalSelectedLat = lat;
          Chow45App._modalSelectedLng = lng;

          // Render Detected Location Confirmation Card ("Is this correct?")
          const card = document.getElementById('campus-gps-confirm-card');
          const streetEl = document.getElementById('campus-gps-detected-street');
          const fullEl = document.getElementById('campus-gps-detected-full');
          if (card && streetEl && fullEl) {
            streetEl.textContent = street;
            fullEl.textContent = fullAddress;
            card.style.display = 'block';
          }

          if (err) err.style.display = 'none';
        } else {
          throw new Error('Reverse geocoding failed');
        }
      } catch (e) {
        const campus = Chow45App._modalCampus || 'sagamu';
        const fallbackStreet = `My Location (${campus === 'ibogun' ? 'Ibogun' : 'Sagamu'})`;
        Chow45App._detectedGps = { lat, lng, street: fallbackStreet, fullAddress: fallbackStreet };
        Chow45App._modalSelectedLat = lat;
        Chow45App._modalSelectedLng = lng;

        const card = document.getElementById('campus-gps-confirm-card');
        const streetEl = document.getElementById('campus-gps-detected-street');
        const fullEl = document.getElementById('campus-gps-detected-full');
        if (card && streetEl && fullEl) {
          streetEl.textContent = fallbackStreet;
          fullEl.textContent = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
          card.style.display = 'block';
        }
      } finally {
        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      }
    };

    const onGeoError = (geoErr) => {
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
      let msg = 'Could not access your location. Please enter your address or tap a campus spot above.';
      if (geoErr && geoErr.code === 1) {
        msg = '🔒 Location permission was denied by your browser. Please allow location permissions in your browser address bar, or type your hostel name below.';
      } else if (geoErr && geoErr.code === 2) {
        msg = '📡 GPS signal unavailable on your device. Please enter your hostel or room address below.';
      } else if (geoErr && geoErr.code === 3) {
        msg = '⏱️ Location detection timed out. Please type your hostel address or tap a campus spot below.';
      }
      if (err) {
        err.innerHTML = msg;
        err.style.display = 'block';
      }
    };

    // Resilient fallback: Try high accuracy first; if it times out/fails, fallback to normal accuracy
    navigator.geolocation.getCurrentPosition(
      (pos) => onCoordsSuccess(pos.coords.latitude, pos.coords.longitude),
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => onCoordsSuccess(pos.coords.latitude, pos.coords.longitude),
          onGeoError,
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  },

  confirmGpsLocation() {
    if (!this._detectedGps) return;
    const input = document.getElementById('campus-address-input');
    if (input) input.value = this._detectedGps.street;
    this._modalSelectedLat = this._detectedGps.lat;
    this._modalSelectedLng = this._detectedGps.lng;

    const card = document.getElementById('campus-gps-confirm-card');
    if (card) card.style.display = 'none';

    this.submitCampusDeliveryLocation();
  },

  rejectGpsLocation() {
    const card = document.getElementById('campus-gps-confirm-card');
    if (card) card.style.display = 'none';

    const input = document.getElementById('campus-address-input');
    if (input) {
      if (this._detectedGps?.street && !input.value.trim()) {
        input.value = this._detectedGps.street;
      }
      input.focus();
    }
    this.toast('You can edit or type your exact hostel or room name', 'info');
  },

  // -------------------------------------------------------------
  // Live Typing Address Autocomplete with Google Maps + Campus Landmarks
  // -------------------------------------------------------------
  handleCampusAddressFocus() {
    const input = document.getElementById('campus-address-input');
    if (input && input.value.trim().length >= 2) {
      this.handleCampusAddressInput(input.value);
    }
  },

  handleCampusAddressInput(rawQuery) {
    const q = (rawQuery || '').trim();
    const dropdown = document.getElementById('campus-autocomplete-dropdown');
    const status = document.getElementById('campus-input-status');
    const err = document.getElementById('campus-modal-error');
    if (err) err.style.display = 'none';

    if (q.length < 2) {
      this.hideCampusAutocomplete();
      return;
    }

    if (status) status.style.display = 'inline';

    clearTimeout(this._autocompleteTimer);
    this._autocompleteTimer = setTimeout(async () => {
      const campus = Chow45App._modalCampus || 'sagamu';
      const config = Chow45App.CAMPUS_CONFIG[campus] || Chow45App.CAMPUS_CONFIG.sagamu;
      const lowerQ = q.toLowerCase();

      // 1. Local campus landmarks that match
      const localMatches = (config.landmarks || [])
        .filter(l => l.name.toLowerCase().includes(lowerQ) || l.sub.toLowerCase().includes(lowerQ))
        .map(l => ({
          text: l.name,
          sub: l.sub,
          lat: l.lat,
          lng: l.lng,
          isCampusLandmark: true
        }));

      // 2. Query Google Places API
      let googleMatches = [];
      try {
        const campusContext = campus === 'ibogun' ? 'Ibogun' : 'Sagamu';
        const res = await fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(q + ' ' + campusContext)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            googleMatches = data.results.map(r => ({
              text: r.text || r.placeName.split(',')[0],
              sub: r.placeName,
              placeId: r.placeId,
              isCampusLandmark: false
            }));
          }
        }
      } catch (e) {
        console.warn('Autocomplete fetch error:', e);
      }

      if (status) status.style.display = 'none';

      // Merge and deduplicate
      const seen = new Set();
      const combined = [];
      [...localMatches, ...googleMatches].forEach(item => {
        const key = item.text.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      });

      if (combined.length === 0) {
        Chow45App.hideCampusAutocomplete();
        return;
      }

      if (dropdown) {
        dropdown.innerHTML = combined.slice(0, 6).map(item => `
          <div class="campus-autocomplete-item"
            onclick="Chow45App.selectCampusSuggestion('${item.text.replace(/'/g, "\\'")}', '${item.placeId || ''}', ${item.lat || 'null'}, ${item.lng || 'null'})"
            style="padding: 10px 14px; border-bottom: 1px solid #F1F5F9; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s;"
            onmouseenter="this.style.background='#F8FAFC'"
            onmouseleave="this.style.background='transparent'">
            <span style="font-size: 1.15rem; flex-shrink: 0;">${item.isCampusLandmark ? (campus === 'ibogun' ? '🏫' : '🏥') : '📍'}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 0.88rem; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${item.text}
              </div>
              <div style="font-size: 0.74rem; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${item.sub}
              </div>
            </div>
          </div>
        `).join('');
        dropdown.style.display = 'block';
      }
    }, 220);
  },

  hideCampusAutocomplete() {
    const dropdown = document.getElementById('campus-autocomplete-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    const status = document.getElementById('campus-input-status');
    if (status) status.style.display = 'none';
  },

  async selectCampusSuggestion(text, placeId, lat, lng) {
    const input = document.getElementById('campus-address-input');
    if (input) input.value = text;
    this.hideCampusAutocomplete();

    if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
      this._modalSelectedLat = lat;
      this._modalSelectedLng = lng;
    } else if (placeId) {
      try {
        const res = await fetch(`/api/geocode/details?placeId=${encodeURIComponent(placeId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lat && data.lng) {
            this._modalSelectedLat = data.lat;
            this._modalSelectedLng = data.lng;
          }
        }
      } catch (e) {
        console.warn('Place details error:', e);
      }
    }

    const err = document.getElementById('campus-modal-error');
    if (err) err.style.display = 'none';
  },

  submitCampusDeliveryLocation() {
    this.hideCampusAutocomplete();
    const campus = this._modalCampus || 'sagamu';
    const input = document.getElementById('campus-address-input');
    const err = document.getElementById('campus-modal-error');
    const rawVal = input ? input.value.trim() : '';

    if (!rawVal) {
      if (err) {
        err.textContent = 'Please enter your hostel, room, or delivery address.';
        err.style.display = 'block';
      }
      return;
    }

    const config = this.CAMPUS_CONFIG[campus] || this.CAMPUS_CONFIG.sagamu;
    const lat = this._modalSelectedLat || config.centerLat;
    const lng = this._modalSelectedLng || config.centerLng;
    const campusName = campus === 'ibogun' ? 'Ibogun' : 'Sagamu';

    // Persist campus
    window.chowStore.setCampus(campus);

    // Persist delivery location
    window.chowStore.setDeliveryLocation({
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      address: rawVal,
      locality: campusName,
      lga: campus === 'ibogun' ? 'Ewekoro/Ifo' : 'Sagamu',
      state: 'Ogun',
      country: 'Nigeria',
      placeId: null,
      formattedAddress: `${rawVal}, ${campusName}, Ogun State`,
      label: 'Campus',
      deliveryInstructions: ''
    });

    const modal = document.getElementById('campus-prompt-modal');
    if (modal) modal.classList.remove('open');

    this.toast(`Welcome to Chow45 ${campusName} Campus!`, 'success');

    // Trigger re-render of customer view with strict campus filtering
    if (typeof CustomerController !== 'undefined' && CustomerController.render) {
      CustomerController.render();
    }
  },

  openLocationModal() {
    this.openCampusModal(true);
  },

  selectLocation(locId) {
    const loc = CHOW45_LOCATIONS.find(l => l.id === locId);
    if (!loc) return;
    window.chowStore.setDeliveryLocation({
      latitude: loc.lat,
      longitude: loc.lng,
      accuracy: null,
      timestamp: Date.now(),
      address: loc.name.split(',')[0],
      locality: loc.city,
      lga: '',
      state: loc.city === 'Lagos' ? 'Lagos' : 'Ogun',
      country: 'Nigeria',
      placeId: null,
      formattedAddress: loc.name,
      zoneId: null,
      zoneName: null,
      label: loc.type || 'Other',
      deliveryInstructions: ''
    });
    const modal = document.getElementById('location-modal');
    if (modal) modal.classList.remove('open');
    this.toast('Delivery location updated', 'success');
  },

  updateLocationUI(loc) {
    const label = document.getElementById('current-location-text');
    if (!label) return;

    const campus = window.chowStore?.state?.selectedCampus || localStorage.getItem('chow45_selected_campus');
    if (!campus) {
      label.innerText = 'Select your campus & location';
      return;
    }

    const campusPrefix = campus === 'ibogun' ? '🏫 Ibogun' : '🏥 Sagamu';
    let addr = (loc && (loc.address || loc.name)) ? (loc.address || loc.name.split(',')[0]) : '';
    if (addr.includes('OOU Main Campus') || addr === 'oou-main') {
      addr = '';
    }
    if (addr) {
      label.innerText = `${campusPrefix} • ${addr}`;
    } else {
      label.innerText = `${campusPrefix} Campus`;
    }
  },

  // -------------------------------------------------------------
  // Global Toast System
  // -------------------------------------------------------------
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ')}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
};

window.chowApp = Chow45App;
window.Chow45App = Chow45App;

// Auto-boot on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  Chow45App.init();
});
