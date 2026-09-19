/**
 * CHOW45 MAIN APPLICATION BOOTSTRAPPER
 * Manages role navigation, global toast notifications, location modal, and lifecycle
 */

const Chow45App = {
  init() {
    console.log('🚀 Initializing Chow45 Food Delivery Marketplace');

    // Initialize all controllers
    CustomerController.init();
    VendorController.init();
    RiderController.init();
    AdminController.init();

    this.bindGlobalEvents();
    this.updateRoleUI(window.chowStore.state.currentRole);
    this.updateLocationUI(window.chowStore.state.selectedLocation);

    // Check URL parameters for direct role jumping (e.g. /app?role=rider or /app?role=vendor)
    const urlParams = new URLSearchParams(window.location.search);
    const initialRole = urlParams.get('role');
    if (initialRole && ['customer', 'vendor', 'rider', 'admin'].includes(initialRole)) {
      this.switchRole(initialRole);
    }
  },

  bindGlobalEvents() {
    // Listen for store role changes
    window.chowStore.subscribe((state) => {
      this.updateRoleUI(state.currentRole);
      this.updateLocationUI(state.selectedLocation);
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });
  },

  switchRole(roleName) {
    window.chowStore.setRole(roleName);
  },

  updateRoleUI(role) {
    // Update role bar buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });

    // Update bottom navigation tabs
    document.querySelectorAll('.bottom-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.role === role);
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
  // Location Selector Modal
  // -------------------------------------------------------------
  openLocationModal() {
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
    window.chowStore.setLocation(locId);
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

// Auto-boot on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  Chow45App.init();
});
