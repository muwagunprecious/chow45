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

    // Initialize all controllers
    CustomerController.init();
    VendorController.init();
    RiderController.init();
    AdminController.init();
    if (typeof Chow45Auth !== 'undefined') {
      Chow45Auth.init();
    }

    this.bindGlobalEvents();

    // Check URL pathname or parameters for direct role jumping (e.g. /vendor/food or /app?role=vendor)
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    let initialRole = urlParams.get('role');

    if (pathname.startsWith('/vendor')) {
      initialRole = 'vendor';
    }

    const isVendorContext = pathname.startsWith('/vendor') ||
      initialRole === 'vendor' ||
      window.chowStore?.state?.currentRole === 'vendor' ||
      sessionStorage.getItem('chow45_vendor_trigger_setup') === 'true';

    // Pull the vendor's real profile from the server whenever in vendor context
    if (isVendorContext && typeof Chow45Auth !== 'undefined') {
      Chow45Auth.loadVendorProfile();
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
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.stores)) {
        window.chowStore.state.restaurants = data.stores;
        window.chowStore.save();
        if (typeof CustomerController !== 'undefined' && CustomerController.render) {
          CustomerController.render();
        }
        if (typeof VendorController !== 'undefined' && VendorController.render) {
          VendorController.render();
        }
      }

      if (data.signedIn && data.user) {
        const u = data.user;
        const role = data.role === 'VENDOR' ? 'vendor' : 'customer';
        const profile = {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          role: role,
          isLoggedIn: true
        };
        if (window.chowStore && window.chowStore.state) {
          window.chowStore.state.userProfile = Object.assign(
            {},
            window.chowStore.state.userProfile || {},
            profile
          );
          if (window.chowStore.saveState) {
            window.chowStore.saveState();
          }
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

    // Close modals on backdrop click (except mandatory first-time setup modal)
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal.id === 'vendor-first-setup-modal') return;
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
    if (roleName === 'vendor' && typeof Chow45Auth !== 'undefined') {
      Chow45Auth.loadVendorProfile();
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
    document.querySelectorAll('.bottom-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.role === role);
    });

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
    if (label && loc) {
      label.innerText = loc.name;
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
