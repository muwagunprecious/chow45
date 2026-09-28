/**
 * CHOW45 VENDOR ONBOARDING GATE
 *
 * A first-time visitor who lands on /vendor is walked through a short wizard
 * before reaching the dashboard:
 *   1. Welcome
 *   2. Service area (Ibogun / Sagammu)
 *   3. Sign in, or create a vendor account if the email is new
 *
 * A vendor who already has a session skips the gate entirely, and the chosen
 * area is written onto the store profile so the rest of the app can scope by it.
 */

const VENDOR_ONBOARDING_ZONE_KEY = 'chow45_vendor_onboarding_zone';

// The zone ids here must match CHOW45_SERVICE_ZONES in service-zones.js.
const VENDOR_ONBOARDING_ZONES = [
  { id: 'ibogun-campus', label: 'Ibogun', area: 'Ifo LGA, Ogun' },
  { id: 'sagamu-campus', label: 'Sagammu', area: 'Sagamu LGA, Ogun' }
];

const VendorOnboarding = {
  step: 0,
  zoneId: null,

  init() {
    if (window._chow45VendorOnboardingReady) return;
    window._chow45VendorOnboardingReady = true;

    this.zoneId = this.readZone();
    if (!this.applies()) return;

    // Auth restores the session before this runs, so a returning vendor is
    // already known here and must not be shown the wizard.
    if (window.Chow45Auth && window.Chow45Auth.isLoggedIn()) {
      this.dismiss();
      return;
    }

    this.show();
  },

  applies() {
    return window.location.pathname.startsWith('/vendor');
  },

  // ------------------------------------------------------------------
  // Zone persistence
  // ------------------------------------------------------------------
  readZone() {
    try {
      const raw = sessionStorage.getItem(VENDOR_ONBOARDING_ZONE_KEY);
      return raw && this.zoneInfo(raw) ? raw : null;
    } catch (e) {
      return null;
    }
  },

  writeZone(zoneId) {
    this.zoneId = zoneId;
    try {
      if (zoneId) {
        sessionStorage.setItem(VENDOR_ONBOARDING_ZONE_KEY, zoneId);
      } else {
        sessionStorage.removeItem(VENDOR_ONBOARDING_ZONE_KEY);
      }
    } catch (e) {
      /* sessionStorage can be unavailable in private mode; the in-memory
         value is still good enough for the current page. */
    }
  },

  zoneInfo(zoneId) {
    return VENDOR_ONBOARDING_ZONES.find(z => z.id === zoneId) || null;
  },

  getZoneId() {
    return this.zoneId;
  },

  getZoneLabel() {
    const info = this.zoneInfo(this.zoneId);
    return info ? info.label : '';
  },

  // ------------------------------------------------------------------
  // Wizard chrome
  // ------------------------------------------------------------------
  show() {
    const modal = document.getElementById('vendor-onboarding');
    if (!modal) return;
    modal.style.display = 'flex';
    // Keep the dashboard out of the tab order and the accessibility tree while
    // the gate is up, so nothing behind it can be reached.
    this.setBackgroundInert(true);
    // Start from the welcome step unless this is a resumed session.
    this.goTo(this.zoneId ? 2 : 0);
  },

  dismiss() {
    const modal = document.getElementById('vendor-onboarding');
    if (modal) modal.style.display = 'none';
    this.setBackgroundInert(false);
  },

  setBackgroundInert(on) {
    const view = document.getElementById('view-vendor');
    if (!view) return;
    if (on) {
      view.setAttribute('inert', '');
      view.setAttribute('aria-hidden', 'true');
    } else {
      view.removeAttribute('inert');
      view.removeAttribute('aria-hidden');
    }
  },

  goTo(index) {
    const steps = document.querySelectorAll('#vendor-onboarding [data-onb-step]');
    if (!steps.length) return;
    const max = steps.length - 1;
    const next = Math.max(0, Math.min(index, max));
    this.step = next;

    steps.forEach((el, i) => el.classList.toggle('active', i === next));

    const dots = document.querySelectorAll('#vendor-onboarding [data-onb-step-dot]');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === next);
      dot.classList.toggle('done', i < next);
    });

    this.syncAreaStep();
    this.syncStepThree();
  },

  /**
   * Keeps the dropdown in step with the stored area, so returning to the step
   * (or resuming after a reload) shows the current choice.
   */
  syncAreaStep() {
    const select = document.getElementById('vnd-onb-zone');
    if (select) select.value = this.zoneId || '';
  },

  syncStepThree() {
    const chip = document.getElementById('vnd-onb-zone-chip');
    if (chip) {
      const info = this.zoneInfo(this.zoneId);
      chip.textContent = info ? `\u{1F4CD} Selling in ${info.label}` : '';
      chip.style.display = info ? 'inline-flex' : 'none';
    }
  },

  next(fromStep) {
    this.goTo(fromStep + 1);
  },

  back() {
    this.goTo(this.step - 1);
  },

  chooseZone() {
    const select = document.getElementById('vnd-onb-zone');
    const hint = document.getElementById('vnd-onb-zone-hint');
    const value = (select?.value || '').trim();

    if (!value) {
      if (hint) {
        hint.textContent = 'Please choose the area where your store is located.';
        hint.style.display = 'block';
      }
      if (select) select.setAttribute('aria-invalid', 'true');
      return false;
    }

    if (select) select.removeAttribute('aria-invalid');
    if (hint) hint.style.display = 'none';
    this.writeZone(value);
    return true;
  },

  /**
   * Step 2's continue button. Stays put when no area is picked so the vendor
   * cannot reach the auth step without an area.
   */
  continueFromArea() {
    if (this.chooseZone()) {
      this.goTo(2);
    }
  },

  // ------------------------------------------------------------------
  // Hand-off to the auth flow
  // ------------------------------------------------------------------
  openAuth() {
    if (!this.zoneId) {
      // Do not let anyone skip the area step.
      this.goTo(1);
      return;
    }
    if (window.Chow45Auth) {
      // Makes an unknown email open the vendor registration step rather than
      // the customer sign-up step.
      window.Chow45Auth.open('vendor');
    }
  },

  /**
   * Called once auth completes. The zone is written onto the store profile so
   * it survives the redirect that follows.
   */
  onAuthenticated() {
    this.dismiss();
    this.applyZoneToStore();
  },

  applyZoneToStore() {
    if (!this.zoneId) return;
    const info = this.zoneInfo(this.zoneId);
    if (!info) return;

    let store = null;
    if (window.VendorController && typeof VendorController.getStore === 'function') {
      store = VendorController.getStore();
    }
    if (!store) return;

    // Never overwrite an area the vendor already chose.
    if (!store.zoneId) {
      store.zoneId = info.id;
      store.zoneName = info.label;
      store.zoneArea = info.area;
      // The store persists across the redirect that follows, so commit now.
      if (window.chowStore && typeof chowStore.save === 'function') {
        chowStore.save();
      }
    }

    // The choice has been committed to the profile, so clear the draft.
    this.writeZone(null);
  }
};

if (typeof window !== 'undefined') {
  window.VendorOnboarding = VendorOnboarding;
}
