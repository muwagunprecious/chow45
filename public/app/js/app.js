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

    const isVendorContext = pathname.startsWith('/vendor') ||
      initialRole === 'vendor' ||
      (pathname !== '/app' && window.chowStore?.state?.currentRole === 'vendor') ||
      sessionStorage.getItem('chow45_vendor_trigger_setup') === 'true';

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
        if (typeof CustomerController !== 'undefined' && CustomerController.render) {
          CustomerController.render();
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
          modal.classList.remove('open');
        }
      });
    });
  },

  switchRole(roleName) {
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
  // Location Selector (Full-screen Mapbox picker)
  // -------------------------------------------------------------
  openLocationModal() {
    if (window.chowLocationPicker) {
      window.chowLocationPicker.open();
      return;
    }

    // Fallback: legacy saved-address modal (if picker script is unavailable)
    const modal = document.getElementById('location-modal');
    const list = document.getElementById('location-options-list');
    if (!modal || !list) return;

    const currentLoc = window.chowStore.state.selectedLocation;

    list.innerHTML = CHOW45_LOCATIONS.map(loc => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid ${currentLoc.id === loc.id ? 'var(--c-primary)' : 'var(--c-border)'}; background: ${currentLoc.id === loc.id ? 'var(--c-primary-surface)' : 'var(--c-bg-surface)'}; margin-bottom: 8px; cursor: pointer;"
           onclick="Chow45App.selectLocation('${loc.id}')">
        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--c-text-primary);">${loc.name}</div>
          <div style="font-size: 0.75rem; color: var(--c-text-secondary);">${loc.city} Zone</div>
        </div>
        ${currentLoc.id === loc.id ? '<span style="color: var(--c-primary); font-weight: 800;">✓</span>' : ''}
      </div>
    `).join('');

    modal.classList.add('open');
  },

  selectLocation(locId) {
    const loc = CHOW45_LOCATIONS.find(l => l.id === locId);
    if (!loc) return;
    // Map legacy quick-picks into a validated delivery location object.
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
    document.getElementById('location-modal').classList.remove('open');
    this.toast('Delivery location updated', 'success');
  },

  updateLocationUI(loc) {
    const label = document.getElementById('current-location-text');
    if (label) {
      if (!loc || !loc.name || loc.id === 'oou-main' || loc.name.includes('OOU Main Campus')) {
        label.innerText = 'Select your location';
      } else {
        label.innerText = loc.name;
      }
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
