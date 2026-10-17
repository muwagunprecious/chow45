/**
 * CHOW45 REDESIGNED AUTHENTICATION & ONBOARDING CONTROLLER
 * Supports Step 1 (Single Email Input), Step 2 Customer (Phone & Address),
 * and Vendor Registration (Store Name, Physical vs Online Store, Picture Upload).
 */

const Chow45Auth = {
  currentStep: 'step1', // 'step1' | 'password' | 'customer' | 'vendor'
  pendingRole: null, // 'USER' | 'VENDOR', set once an existing account is found
  intent: null, // 'vendor' when the vendor onboarding gate started the flow
  vendorStoreType: 'physical', // 'physical' | 'online'
  uploadedPhotoDataUrl: '',
  STORAGE_KEY: 'chow45_auth_session_v1',

  init() {
    this.restoreSession();
    this.syncServerSession();
    this.handleUrlParams();
    this.updateUI();
    this.bindEmailInputs();
    this.bindMobileProfileNav();
  },

  bindMobileProfileNav() {
    const btn = document.getElementById('bottom-nav-profile-btn');
    if (btn && btn.dataset.boundProfileClick !== 'true') {
      btn.dataset.boundProfileClick = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openMobileProfile(e);
      });
    }
  },

  isVendorUser() {
    const user = this.getUser();
    return !!(user && user.isLoggedIn && (String(user.role).toLowerCase() === 'vendor' || !!user.storeId || !!user.vendorId));
  },

  async loginWithGoogle(intent = null) {
    try {
      const effectiveIntent = intent || this.intent || (window.location.pathname.startsWith('/vendor') ? 'vendor' : 'customer');
      const callbackURL = `${window.location.origin}/api/auth/post-login?intent=${encodeURIComponent(effectiveIntent)}`;

      const btn = document.getElementById('auth-google-btn');
      if (btn) {
        btn.disabled = true;
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Connecting to Google...';
      }

      const res = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'google',
          callbackURL: callbackURL,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (res.ok) {
        window.location.href = callbackURL;
        return;
      }

      const msg = data?.message || data?.error || 'Could not connect with Google. Please try again.';
      this.showAlert(this.currentStep || 'step1', msg);
    } catch (e) {
      console.error('[auth] Google sign-in failed:', e);
      this.showAlert(this.currentStep || 'step1', 'Network error during Google sign in.');
    } finally {
      const btn = document.getElementById('auth-google-btn');
      if (btn) {
        btn.disabled = false;
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Continue with Google';
      }
    }
  },

  async syncServerSession() {
    try {
      const res = await fetch('/api/auth/get-session', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.user) {
          const u = data.user;
          const currentProfile = window.chowStore?.state?.userProfile || {};
          const isVendor = u.role?.toLowerCase() === 'vendor' || window.location.pathname.startsWith('/vendor');
          const updatedUser = {
            ...currentProfile,
            id: u.id,
            name: u.name || currentProfile.name || 'User',
            email: u.email || currentProfile.email || '',
            image: u.image || currentProfile.image || '',
            avatar: u.image || u.avatar || currentProfile.avatar || '',
            role: isVendor ? 'vendor' : (u.role?.toLowerCase() === 'rider' ? 'rider' : 'customer'),
            isLoggedIn: true,
          };
          this.completeLogin(updatedUser);


          if (isVendor && !window.location.pathname.startsWith('/vendor')) {
            window.location.replace('/vendor');
            return;
          }
        }
      }
    } catch (e) {
      // Background sync silent on network hiccup
    }
  },

  handleUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'google_success') {
        if (window.chowApp && window.chowApp.toast) {
          window.chowApp.toast('Successfully signed in with Google!', 'success');
        }
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      if (params.get('role') === 'vendor' && params.get('action') === 'onboard') {
        const em = params.get('email') || '';
        const nm = params.get('name') || '';
        this.open('vendor');
        this.showVendorStep(em);
        const storeInput = document.getElementById('auth-vnd-store-name');
        if (storeInput && nm && !storeInput.value) {
          storeInput.value = `${nm}'s Kitchen`;
        }
        if (window.chowApp && window.chowApp.toast) {
          window.chowApp.toast('Google account linked! Please enter your store details to start selling.', 'info');
        }
      }
    } catch (e) {}
  },


  async checkEmailAccount(email) {
    if (!email || typeof email !== 'string') return null;
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@') || !clean.includes('.')) return null;

    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[auth] check-email failed:', e);
    }
    return null;
  },

  async checkVendorEmailInput() {
    const input = document.getElementById('auth-vnd-email');
    const email = (input?.value || '').trim();
    if (!email || !email.includes('@') || !email.includes('.')) return;

    const lookup = await this.checkEmailAccount(email);
    if (lookup && lookup.exists) {
      // Vendor already has an account! Transition directly to password step
      this.showPasswordStep(lookup.role || 'VENDOR', email);
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Account found! Please enter your password to sign in.', 'info');
      }
    }
  },

  async checkCustomerEmailInput() {
    const input = document.getElementById('auth-cust-email');
    const email = (input?.value || '').trim();
    if (!email || !email.includes('@') || !email.includes('.')) return;

    const lookup = await this.checkEmailAccount(email);
    if (lookup && lookup.exists) {
      this.showPasswordStep(lookup.role || 'USER', email);
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Account found! Please enter your password to sign in.', 'info');
      }
    }
  },

  async checkStep1EmailInput(isExplicitTrigger = false) {
    const input = document.getElementById('auth-step1-email');
    const email = (input?.value || '').trim();
    if (!email || !email.includes('@') || !email.includes('.')) return;
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return;

    const btn = document.getElementById('auth-step1-btn');
    if (btn) {
      btn.disabled = true;
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Checking...';
    }

    try {
      const lookup = await this.checkEmailAccount(email);

      // Pre-fill email across all downstream forms
      const custEmail = document.getElementById('auth-cust-email');
      const vndEmail = document.getElementById('auth-vnd-email');
      const custDisp = document.getElementById('auth-cust-email-display');
      const vndDisp = document.getElementById('auth-vnd-email-display');
      if (custEmail) custEmail.value = email;
      if (vndEmail) vndEmail.value = email;
      if (custDisp) custDisp.textContent = email;
      if (vndDisp) vndDisp.textContent = email;

      if (lookup && lookup.exists) {
        // Account exists -> Immediately prompt for password!
        this.showPasswordStep(lookup.role || 'USER', email);
        return;
      }

      if (lookup && !lookup.exists) {
        // No account -> Immediately prompt for signup form!
        if (this.intent === 'vendor') {
          this.showVendorStep(email);
        } else {
          this.showCustomerStep(email);
        }
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Continue →';
      }
    }
  },

  _debounceTimer: null,
  bindEmailInputs() {
    const step1El = document.getElementById('auth-step1-email');
    if (step1El && step1El.dataset.boundEmailCheck !== 'true') {
      step1El.dataset.boundEmailCheck = 'true';

      step1El.addEventListener('input', () => {
        clearTimeout(this._debounceTimer);
        const val = (step1El.value || '').trim();
        // Check when user has typed a valid email format e.g. name@domain.com
        if (/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(val)) {
          this._debounceTimer = setTimeout(() => {
            this.checkStep1EmailInput(false);
          }, 450);
        }
      });

      step1El.addEventListener('blur', () => {
        const val = (step1El.value || '').trim();
        if (/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(val)) {
          this.checkStep1EmailInput(true);
        }
      });
    }
  },

  restoreSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.user) {
          if (window.chowStore && window.chowStore.state) {
            if (typeof window.chowStore.ensureUserProfileIntegrity === 'function') {
              window.chowStore.ensureUserProfileIntegrity();
            }
            window.chowStore.state.userProfile = Object.assign(
              {},
              window.chowStore.state.userProfile || {},
              session.user,
              { isLoggedIn: true }
            );
            if (typeof window.chowStore.ensureUserProfileIntegrity === 'function') {
              window.chowStore.ensureUserProfileIntegrity();
            }
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Could not parse auth session:', e);
    }

    if (window.chowStore && window.chowStore.state && window.chowStore.state.userProfile) {
      const p = window.chowStore.state.userProfile;
      if (p.isLoggedIn == null) {
        p.isLoggedIn = false;
      }
    }
  },

  getUser() {
    if (window.chowStore && window.chowStore.state && window.chowStore.state.userProfile) {
      return window.chowStore.state.userProfile;
    }
    return { isLoggedIn: false, name: 'Guest', phone: '', email: '' };
  },

  isLoggedIn() {
    const user = this.getUser();
    return !!user.isLoggedIn;
  },

  /**
   * @param {'vendor'|'profile'|Event} [intentOrEvent]
   */
  open(intentOrEvent) {
    let intent = null;
    if (intentOrEvent) {
      if (typeof intentOrEvent === 'string') {
        intent = intentOrEvent;
      } else if (intentOrEvent && typeof intentOrEvent.preventDefault === 'function') {
        try { intentOrEvent.preventDefault(); } catch (e) {}
      }
    }

    try {
      if (intent === 'profile') {
        this.openProfile();
        return;
      }

      if (this.isLoggedIn()) {
        this.openAccountModal();
        return;
      }

      const modal = document.getElementById('auth-modal');
      if (!modal) return;

      this.showStep1();
      // Automatically detect vendor context if on /vendor or current role is vendor
      const isVendorContext = intent === 'vendor' || window.location.pathname.startsWith('/vendor') || (window.chowStore?.state?.currentRole === 'vendor');
      this.intent = isVendorContext ? 'vendor' : (intent || null);
      modal.classList.add('open');
    } catch (err) {
      console.error('[auth] Error opening auth modal:', err);
    }
  },

  openSignOutConfirm() {
    const modal = document.getElementById('signout-confirm-modal');
    if (!modal) {
      if (confirm('Sign out of Chow45?')) {
        this.signOut();
      }
      return;
    }

    const user = this.getUser() || {};
    const isVendor = (String(user.role).toLowerCase() === 'vendor') ||
      window.location.pathname.startsWith('/vendor') ||
      (window.chowStore?.state?.currentRole === 'vendor');

    const nameEl = document.getElementById('signout-user-name');
    const dispNameEl = document.getElementById('signout-user-display-name');
    const emailEl = document.getElementById('signout-user-email');
    const badgeEl = document.getElementById('signout-user-badge');
    const avatarEl = document.getElementById('signout-user-avatar');

    let displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    if (isVendor) {
      const store = (window.VendorController && typeof window.VendorController.getStore === 'function')
        ? window.VendorController.getStore()
        : null;
      if (store?.name) displayName = store.name;
    }

    if (nameEl) nameEl.textContent = displayName;
    if (dispNameEl) dispNameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || 'account@chow45.com';
    if (badgeEl) {
      badgeEl.textContent = isVendor ? 'Vendor' : 'Customer';
      badgeEl.style.background = isVendor ? '#DCFCE7' : '#E8F6F0';
      badgeEl.style.color = isVendor ? '#15803D' : '#008751';
    }
    if (avatarEl) {
      const avatarUrl = user.image || user.avatar || user.picture;
      if (avatarUrl && typeof avatarUrl === 'string' && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'))) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.textContent='${displayName.trim().charAt(0).toUpperCase() || 'U'}';" />`;
      } else {
        const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
        avatarEl.textContent = initial;
        avatarEl.style.background = isVendor ? '#15803D' : '#008751';
      }
    }

    modal.classList.add('open');

  },

  closeSignOutConfirm() {
    const modal = document.getElementById('signout-confirm-modal');
    if (modal) modal.classList.remove('open');
  },

  openProfile(event) {
    if (event && typeof event.preventDefault === 'function') {
      try { event.preventDefault(); } catch (e) {}
    }
    if (this.isLoggedIn()) {
      this.openSignOutConfirm();
    } else {
      this.open();
    }
  },

  openMobileProfile(event) {
    if (event && typeof event.preventDefault === 'function') {
      try { event.preventDefault(); } catch (e) {}
    }
    this.openAccountModal(event);
  },

  openGuestSignIn() {
    this.close();
    this.showStep1();
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('open');
  },

  close() {
    try {
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.remove('open');

      const accountModal = document.getElementById('account-modal');
      if (accountModal) accountModal.classList.remove('open');

      const signoutModal = document.getElementById('signout-confirm-modal');
      if (signoutModal) signoutModal.classList.remove('open');
    } catch (e) {}
  },

  openAccountModal(event) {
    if (event && typeof event.preventDefault === 'function') {
      try { event.preventDefault(); } catch (e) {}
    }

    try {
      const modal = document.getElementById('account-modal');
      if (!modal) {
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.classList.add('open');
        return;
      }

      modal.classList.add('open');

      const user = this.getUser() || {};

      const isLoggedIn = !!user.isLoggedIn;
      const isVendor = (user.role === 'vendor') ||
        window.location.pathname.startsWith('/vendor') ||
        (window.chowStore?.state?.currentRole === 'vendor');

      const headerTitle = document.getElementById('account-modal-header-title');
      const custSec = document.getElementById('account-customer-section');
      const vndSec = document.getElementById('account-vendor-section');
      const signoutBtn = document.getElementById('account-signout-btn');
      const guestSigninBtn = document.getElementById('account-guest-signin-btn');

      if (isVendor) {
        if (headerTitle) headerTitle.textContent = 'Vendor Store Profile';
        if (custSec) custSec.style.display = 'none';
        if (vndSec) vndSec.style.display = 'block';
        if (signoutBtn) signoutBtn.style.display = 'flex';
        if (guestSigninBtn) guestSigninBtn.style.display = 'none';

        const store = (window.VendorController && typeof window.VendorController.getStore === 'function')
          ? window.VendorController.getStore()
          : null;

        const storeName = store?.name || user.name || 'Your Kitchen';
        const storePhone = store?.phone || user.phone || '+234 812 450 4500';
        const storeEmail = store?.email || store?.contactEmail || user.email || 'vendor@chow45.com';
        const storeAddress = store?.address || 'Sagamu Campus (OSUTH), Sagamu';
        const isOpen = store ? store.isOpen !== false : true;

        const vndTitleEl = document.getElementById('account-vnd-title');
        const vndStatusBadge = document.getElementById('account-vnd-status-badge');
        const vndPhoneEl = document.getElementById('account-vnd-phone-text');
        const vndEmailEl = document.getElementById('account-vnd-email-text');
        const vndAddrEl = document.getElementById('account-vnd-address-text');
        const vndAvatarEl = document.getElementById('account-vnd-avatar');

        if (vndTitleEl) vndTitleEl.textContent = storeName;
        if (vndStatusBadge) {
          vndStatusBadge.textContent = isOpen ? '● OPEN' : '○ CLOSED';
          vndStatusBadge.style.background = isOpen ? '#DCFCE7' : '#FEE2E2';
          vndStatusBadge.style.color = isOpen ? '#15803D' : '#B91C1C';
        }
        if (vndPhoneEl) vndPhoneEl.textContent = storePhone;
        if (vndEmailEl) vndEmailEl.textContent = storeEmail;
        if (vndAddrEl) vndAddrEl.textContent = '📍 ' + storeAddress;
        if (vndAvatarEl && store?.image) {
          vndAvatarEl.src = store.image;
        }
      } else {
        if (headerTitle) headerTitle.textContent = 'My Profile';
        if (custSec) custSec.style.display = 'block';
        if (vndSec) vndSec.style.display = 'none';

        const nameEl = document.getElementById('account-display-name');
        const emailEl = document.getElementById('account-display-email');
        const phoneEl = document.getElementById('account-display-phone');
        const badgeEl = document.getElementById('account-role-badge');
        const avatarEl = document.getElementById('account-avatar-char');
        const locsCountEl = document.getElementById('account-locations-count');
        const addrTextEl = document.getElementById('account-display-address-text');

        // Rewards elements
        const ptsEl = document.getElementById('account-rewards-points');
        const tierEl = document.getElementById('account-rewards-tier');
        const barEl = document.getElementById('account-rewards-bar');
        const perkEl = document.getElementById('account-rewards-perk-hint');

        // Order metric elements
        const totalOrdersEl = document.getElementById('account-total-orders-count');
        const activeOrdersEl = document.getElementById('account-active-orders-count');
        const savedLocsBadgeEl = document.getElementById('account-saved-locations-badge');
        const orderHistoryHint = document.getElementById('account-order-history-hint');

        const currentAddress = user.address ||
          window.chowStore?.state?.selectedLocation?.formattedAddress ||
          window.chowStore?.state?.selectedLocation?.name ||
          '';

        const saved = Array.isArray(user.savedAddresses) ? user.savedAddresses : (window.chowStore?.state?.userProfile?.savedAddresses || []);
        const savedCount = saved.length;

        // Calculate orders from store state
        const allOrders = Array.isArray(window.chowStore?.state?.orders) ? window.chowStore.state.orders : [];
        const totalOrdersCount = allOrders.length;
        const activeOrdersCount = allOrders.filter(o => o && !['DELIVERED', 'REJECTED'].includes(o.status)).length;

        if (totalOrdersEl) totalOrdersEl.textContent = String(totalOrdersCount);
        if (activeOrdersEl) {
          activeOrdersEl.textContent = String(activeOrdersCount);
          activeOrdersEl.style.color = activeOrdersCount > 0 ? '#16A34A' : '#64748B';
        }
        if (savedLocsBadgeEl) savedLocsBadgeEl.textContent = String(savedCount);

        if (locsCountEl) {
          locsCountEl.textContent = savedCount > 0 ? `${savedCount} saved location${savedCount > 1 ? 's' : ''}` : 'Set Campus, Home & Work';
        }

        if (orderHistoryHint) {
          orderHistoryHint.textContent = totalOrdersCount > 0
            ? `${totalOrdersCount} past order${totalOrdersCount > 1 ? 's' : ''} • View status & receipts`
            : 'View past orders and order status';
        }

        if (isLoggedIn) {
          const displayName = user.name || (user.email ? user.email.split('@')[0] : 'Chow45 Customer');
          if (nameEl) nameEl.textContent = displayName;
          if (emailEl) emailEl.textContent = user.email || 'customer@chow45.com';
          if (phoneEl) phoneEl.textContent = user.phone || '+234 812 450 4500';
          if (addrTextEl) addrTextEl.textContent = currentAddress || 'No delivery address set';

          if (badgeEl) {
            badgeEl.textContent = 'Customer';
            badgeEl.className = 'account-badge customer';
            badgeEl.style.background = '#E8F6F0';
            badgeEl.style.color = 'var(--c-primary, #008751)';
          }
          if (avatarEl) {
            const avatarUrl = user.image || user.avatar || user.picture;
            if (avatarUrl && typeof avatarUrl === 'string' && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'))) {
              avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.textContent='${displayName.trim().charAt(0).toUpperCase() || 'C'}';" />`;
            } else {
              const initial = displayName.trim().charAt(0).toUpperCase();
              avatarEl.textContent = initial || 'C';
            }
          }


          // Rewards calculation: 50 welcome points + 15 points per order placed
          const points = (user.rewardsPoints != null) ? user.rewardsPoints : (50 + totalOrdersCount * 15);
          if (ptsEl) ptsEl.textContent = String(points);

          let tier = 'Campus Bronze';
          let perk = 'Earn 15 pts on every order • Redeem for delivery discounts';
          let progressPercent = 35;

          if (points >= 250) {
            tier = '🥇 Campus VIP';
            perk = 'Free delivery perks unlocked! • 10% off selected restaurants';
            progressPercent = 100;
          } else if (points >= 100) {
            tier = '🥈 Silver Gourmet';
            perk = '₦200 off campus delivery • Priority rider dispatch';
            progressPercent = Math.min(90, Math.round((points / 250) * 100));
          } else {
            tier = '🥉 Campus Bronze';
            perk = 'Earn 15 pts on every order • Reach 100 pts for Silver Gourmet';
            progressPercent = Math.min(65, Math.max(25, Math.round((points / 100) * 100)));
          }

          if (tierEl) tierEl.textContent = tier;
          if (barEl) barEl.style.width = `${progressPercent}%`;
          if (perkEl) perkEl.textContent = perk;

          if (signoutBtn) signoutBtn.style.display = 'flex';
          if (guestSigninBtn) guestSigninBtn.style.display = 'none';
        } else {
          // Guest State
          if (nameEl) nameEl.textContent = 'Guest Explorer';
          if (emailEl) emailEl.textContent = 'Sign in to access your account';
          if (phoneEl) phoneEl.textContent = 'No phone attached';
          if (addrTextEl) addrTextEl.textContent = currentAddress || 'Pick delivery location';

          if (badgeEl) {
            badgeEl.textContent = 'Guest';
            badgeEl.className = 'account-badge';
            badgeEl.style.background = '#E2E8F0';
            badgeEl.style.color = '#475569';
          }
          if (avatarEl) avatarEl.textContent = 'G';

          if (ptsEl) ptsEl.textContent = '50';
          if (tierEl) tierEl.textContent = '🎁 Welcome Bonus';
          if (barEl) barEl.style.width = '30%';
          if (perkEl) perkEl.textContent = 'Sign in to claim your 50 ChowPoints welcome bonus!';

          if (signoutBtn) signoutBtn.style.display = 'none';
          if (guestSigninBtn) guestSigninBtn.style.display = 'flex';
        }

        const vendorBtn = document.getElementById('account-vendor-dash-btn');
        if (vendorBtn) {
          vendorBtn.style.display = (user.role === 'vendor' || user.storeId) ? 'flex' : 'none';
        }

        // Pre-fill edit inputs
        const editName = document.getElementById('account-edit-name');
        const editPhone = document.getElementById('account-edit-phone');
        const editAddr = document.getElementById('account-edit-address');
        if (editName) editName.value = (isLoggedIn && user.name) ? user.name : '';
        if (editPhone) editPhone.value = (isLoggedIn && user.phone) ? user.phone : '';
        if (editAddr) editAddr.value = currentAddress || '';
      }

      modal.classList.add('open');
    } catch (err) {
      console.error('[auth] Error opening account modal:', err);
    }
  },

  toggleEditProfile(forceState) {
    const form = document.getElementById('account-profile-edit-form');
    const label = document.getElementById('account-edit-toggle-label');
    const icon = document.getElementById('account-edit-toggle-icon');
    if (!form) return;

    const willShow = forceState !== undefined ? forceState : (form.style.display === 'none' || !form.style.display);
    form.style.display = willShow ? 'block' : 'none';

    if (label) label.textContent = willShow ? 'Close Edit Form' : 'Edit Personal Profile';
    if (icon) icon.textContent = willShow ? '✕' : '✏️';
  },

  async captureProfileAddress() {
    await this._captureLiveLocation('account-edit-address', 'Delivery Address');
  },

  async saveProfileChanges() {
    const editName = document.getElementById('account-edit-name');
    const editPhone = document.getElementById('account-edit-phone');
    const editAddr = document.getElementById('account-edit-address');

    const newName = (editName?.value || '').trim();
    const newPhone = (editPhone?.value || '').trim();
    const newAddress = (editAddr?.value || '').trim();

    if (!newName) {
      if (window.chowApp?.toast) window.chowApp.toast('Please enter your full name', 'warning');
      return;
    }

    const user = this.getUser();
    user.name = newName;
    if (newPhone) user.phone = newPhone;
    if (newAddress) user.address = newAddress;

    if (window.chowStore?.state) {
      window.chowStore.state.userProfile = Object.assign({}, window.chowStore.state.userProfile || {}, user);
      if (newAddress) {
        window.chowStore.state.selectedLocation = {
          name: newAddress,
          formattedAddress: newAddress,
          type: 'current',
          isUserSelected: true
        };
      }
      if (typeof window.chowStore.save === 'function') window.chowStore.save();
    }

    // Persist in localStorage
    try {
      const session = {
        token: 'chow45_session_' + Date.now(),
        user: user,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    } catch (e) {}

    // Persist to server API
    try {
      await fetch('/api/customer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: newName,
          phone: newPhone,
          address: newAddress
        })
      });
    } catch (e) {
      console.warn('[auth] Could not sync customer profile to server:', e);
    }

    this.toggleEditProfile(false);
    this.updateUI();
    this.openAccountModal();

    if (window.chowApp?.toast) {
      window.chowApp.toast('Profile updated successfully!', 'success');
    }
  },

  // -------------------------------------------------------------
  // Step Navigation
  // -------------------------------------------------------------
  showStep1() {
    this.currentStep = 'step1';
    this.pendingRole = null;
    // Do NOT reset intent here: a user navigating back from the vendor form
    // (intent='vendor') must remain in vendor context so unknown emails route
    // to vendor registration, not customer signup.
    this.clearAlerts();

    const s1 = document.getElementById('auth-step-1');
    const sp = document.getElementById('auth-step-password');
    const sc = document.getElementById('auth-step-customer');
    const sv = document.getElementById('auth-step-vendor');
    const backBtn = document.getElementById('auth-header-back-btn');
    const tag = document.getElementById('auth-modal-header-tag');

    if (s1) s1.style.display = 'block';
    if (sp) sp.style.display = 'none';
    if (sc) sc.style.display = 'none';
    if (sv) sv.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    if (tag) tag.textContent = 'Sign In / Join';

    this.bindEmailInputs();

    const lastEmail = localStorage.getItem('chow45_last_auth_email');
    const inp = document.getElementById('auth-step1-email');
    if (inp && !inp.value && lastEmail) {
      inp.value = lastEmail;
    }

    setTimeout(() => {
      if (inp) inp.focus();
    }, 60);
  },

  /**
   * Step 1 submit.
   *
   * Asks the server whether the email is already registered. Existing accounts
   * go to the password step and are routed to the page for their role; new
   * emails fall through to the customer profile step as before.
   */
  async handleStep1Continue() {
    this.clearAlerts();
    const emailInput = document.getElementById('auth-step1-email');
    const email = (emailInput?.value || '').trim();
    const btn = document.getElementById('auth-step1-btn');

    if (!email) {
      this.showAlert('step1', 'Please enter your email address to continue.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      this.showAlert('step1', 'Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Checking...';
    }

    let lookup;
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      lookup = await res.json().catch(() => ({}));

      if (!res.ok) {
        this.showAlert('step1', lookup?.error || 'Could not reach the server. Please try again.');
        return;
      }
    } catch {
      this.showAlert('step1', 'Network error. Please check your connection and try again.');
      return;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Continue →';
      }
    }

    // Pre-fill email for the customer, vendor and password steps
    const custEmail = document.getElementById('auth-cust-email');
    const vndEmail = document.getElementById('auth-vnd-email');
    if (custEmail) custEmail.value = email;
    if (vndEmail) vndEmail.value = email;

    if (lookup?.exists) {
      this.showPasswordStep(lookup.role || 'USER', email);
      return;
    }

    // Account does NOT exist -> Immediately prompt for Sign Up!
    if (this.intent === 'vendor') {
      this.showVendorStep(email);
      return;
    }

    this.showCustomerStep(email);
  },

  saveCredentials(email, password, role) {
    if (!email) return;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const existing = JSON.parse(localStorage.getItem('chow45_saved_credentials') || '{}');
      existing[cleanEmail] = {
        password: password || '',
        role: role || 'USER',
        savedAt: Date.now()
      };
      localStorage.setItem('chow45_saved_credentials', JSON.stringify(existing));
      localStorage.setItem('chow45_last_auth_email', cleanEmail);
    } catch (e) {
      console.warn('[auth] Could not save credentials:', e);
    }
  },

  getSavedPasswordFor(email) {
    if (!email) return '';
    try {
      const cleanEmail = email.trim().toLowerCase();
      const existing = JSON.parse(localStorage.getItem('chow45_saved_credentials') || '{}');
      return existing[cleanEmail]?.password || '';
    } catch {
      return '';
    }
  },

  _showAutofillHint(show) {
    let hint = document.getElementById('auth-pw-autofill-hint');
    if (!hint) {
      const pwInput = document.getElementById('auth-password');
      const pwWrap = pwInput?.closest('.auth-input-wrap');
      if (pwWrap && pwWrap.parentNode) {
        hint = document.createElement('div');
        hint.id = 'auth-pw-autofill-hint';
        hint.style.cssText = 'color: #0C513F; font-size: 0.76rem; font-weight: 600; margin-top: 5px; display: flex; align-items: center; gap: 4px;';
        hint.innerHTML = '<span>✓</span> Password auto-filled from your saved login';
        pwWrap.parentNode.insertBefore(hint, pwWrap.nextSibling);
      }
    }
    if (hint) hint.style.display = show ? 'flex' : 'none';
  },

  /**
   * Shows the password step for an account that already exists.
   *
   * `role` decides which sign-in endpoint is used and which page the user is
   * sent to once the password is accepted.
   */
  showPasswordStep(role, email) {
    this.currentStep = 'password';
    this.pendingRole = role === 'VENDOR' ? 'VENDOR' : 'USER';
    this.clearAlerts();

    const s1 = document.getElementById('auth-step-1');
    const sp = document.getElementById('auth-step-password');
    const sc = document.getElementById('auth-step-customer');
    const sv = document.getElementById('auth-step-vendor');
    const backBtn = document.getElementById('auth-header-back-btn');
    const tag = document.getElementById('auth-modal-header-tag');
    const emailField = document.getElementById('auth-password-email');
    const emailDisplay = document.getElementById('auth-password-email-display');
    const pwField = document.getElementById('auth-password');
    const heading = document.getElementById('auth-password-heading');
    const subheading = document.getElementById('auth-password-subheading');

    if (s1) s1.style.display = 'none';
    if (sp) sp.style.display = 'block';
    if (sc) sc.style.display = 'none';
    if (sv) sv.style.display = 'none';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (tag) tag.textContent = this.pendingRole === 'VENDOR' ? 'Vendor Sign In' : 'Sign In';

    if (emailField) emailField.value = email || '';
    if (emailDisplay) emailDisplay.textContent = email || '';

    // Check for saved password for this account and auto-fill immediately
    const savedPassword = this.getSavedPasswordFor(email);
    if (pwField) {
      if (savedPassword) {
        pwField.value = savedPassword;
        this._showAutofillHint(true);
      } else {
        pwField.value = '';
        this._showAutofillHint(false);
      }

      // Track password changes and save them automatically
      if (!pwField.dataset.saveBound) {
        pwField.dataset.saveBound = 'true';
        pwField.addEventListener('input', () => {
          const currentEmail = document.getElementById('auth-password-email')?.value || email;
          if (currentEmail && pwField.value) {
            this.saveCredentials(currentEmail, pwField.value, this.pendingRole);
          }
        });
      }
    }

    if (heading) {
      heading.textContent = this.pendingRole === 'VENDOR' ? 'Welcome back, Vendor' : 'Welcome back';
    }
    if (subheading) {
      subheading.textContent = this.pendingRole === 'VENDOR'
        ? 'Enter your password to reach your restaurant dashboard.'
        : 'Enter your password to sign in.';
    }

    setTimeout(() => {
      if (pwField) pwField.focus();
    }, 60);
  },

  /**
   * Signs in against the role-specific Better Auth endpoint and sends the user
   * to that role's page.
   */
  async handlePasswordSubmit() {
    this.clearAlerts();

    const email = (document.getElementById('auth-password-email')?.value || '').trim();
    const password = document.getElementById('auth-password')?.value || '';
    const btn = document.getElementById('auth-password-btn');

    if (!email || !email.includes('@')) {
      this.showAlert('password', 'Please enter a valid email address.', { inlineOnly: true });
      return;
    }
    if (!password) {
      this.showAlert('password', 'Please enter your password.', { inlineOnly: true });
      return;
    }

    const role = this.pendingRole === 'VENDOR' ? 'VENDOR' : 'USER';
    const endpoint = role === 'VENDOR' ? '/api/auth/vendor/sign-in/email' : '/api/auth/user/sign-in/email';

    if (btn) {
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Signing in...';
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        let message = 'Incorrect password. Please try again.';
        try {
          const body = await res.json();
          if (body?.error === 'INVALID_CREDENTIALS') {
            message = 'Incorrect password. Please try again.';
          } else if (body?.message && !/invalid/i.test(body.message)) {
            message = body.message;
          }
        } catch { /* keep the default message */ }
        this.showAlert('password', message, { inlineOnly: true });
        return;
      }

      // Save credentials for instant auto-fill next time
      this.saveCredentials(email, password, role);

      // Reflect the signed-in user locally so the shell renders correctly if
      // the destination page is ever loaded without a full reload.
      let name = email.split('@')[0];
      let resUser = null;
      try {
        const body = await res.json();
        if (body?.user) resUser = body.user;
        if (body?.user?.name) name = body.user.name;
      } catch { /* fall back to the email local-part */ }

      this.completeLogin({
        id: resUser?.id,
        name,
        email,
        role: role === 'VENDOR' ? 'vendor' : 'customer'
      });

      // If logging in as vendor, prime store profile immediately
      if (role === 'VENDOR') {
        try {
          const profRes = await fetch(`/api/vendor/profile?email=${encodeURIComponent(email)}`, {
            headers: { 'x-vendor-email': email },
            credentials: 'include'
          });
          if (profRes.ok) {
            const profData = await profRes.json();
            if (profData?.vendor) {
              const v = profData.vendor;
              this.completeLogin({
                id: resUser?.id || v.userId,
                name: v.businessName || name,
                email: v.contactEmail || email,
                role: 'vendor',
                vendorId: v.id,
                storeId: v.storeId
              });
            }
          }
        } catch {}
      }

      this.close();

      if (email.toLowerCase().trim() === 'tolaniakin2022@gmail.com') {
        sessionStorage.setItem('chow45_vendor_trigger_setup', 'true');
      }

      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast(`Welcome back, ${name.split(' ')[0]}!`, 'success');
      }

      window.location.href = role === 'VENDOR' ? '/vendor' : '/app';
    } catch {
      this.showAlert('password', 'Network error. Please check your connection and try again.', { inlineOnly: true });
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Sign In →';
      }
    }
  },

  /**
   * Fills the password step with one of the seeded demo accounts.
   */
  fillDemoAccount(kind) {
    const demo = kind === 'vendor'
      ? { email: 'vendor@chow45.test', password: 'Chow45Vendor!2026', role: 'VENDOR' }
      : { email: 'user@chow45.test', password: 'Chow45User!2026', role: 'USER' };

    const step1Email = document.getElementById('auth-step1-email');
    if (step1Email) step1Email.value = demo.email;

    this.showPasswordStep(demo.role, demo.email);

    const pw = document.getElementById('auth-password');
    if (pw) pw.value = demo.password;
  },

  showCustomerStep(emailParam) {
    this.currentStep = 'customer';
    this.clearAlerts();

    const email = emailParam || document.getElementById('auth-step1-email')?.value?.trim() || '';
    const s1 = document.getElementById('auth-step-1');
    const sp = document.getElementById('auth-step-password');
    const sc = document.getElementById('auth-step-customer');
    const sv = document.getElementById('auth-step-vendor');
    const backBtn = document.getElementById('auth-header-back-btn');
    const tag = document.getElementById('auth-modal-header-tag');
    const custEmailInp = document.getElementById('auth-cust-email');
    const custEmailDisp = document.getElementById('auth-cust-email-display');

    if (s1) s1.style.display = 'none';
    if (sp) sp.style.display = 'none';
    if (sc) sc.style.display = 'block';
    if (sv) sv.style.display = 'none';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (tag) tag.textContent = 'Create Account';

    if (custEmailInp) custEmailInp.value = email;
    if (custEmailDisp) custEmailDisp.textContent = email;

    // Auto-fill delivery address from active selected location if empty
    const addrInput = document.getElementById('auth-cust-address');
    if (addrInput && !addrInput.value) {
      if (window.chowStore && window.chowStore.state && window.chowStore.state.selectedLocation) {
        const loc = window.chowStore.state.selectedLocation;
        addrInput.value = loc.formattedAddress || loc.name || '';
      }
    }

    setTimeout(() => {
      const phoneInp = document.getElementById('auth-cust-phone');
      if (phoneInp) phoneInp.focus();
    }, 60);
  },

  showVendorStep(emailParam) {
    this.currentStep = 'vendor';
    this.clearAlerts();

    const email = emailParam || document.getElementById('auth-step1-email')?.value?.trim() || '';
    const vndEmail = document.getElementById('auth-vnd-email');
    const vndEmailDisp = document.getElementById('auth-vnd-email-display');
    if (vndEmail) vndEmail.value = email;
    if (vndEmailDisp) vndEmailDisp.textContent = email;

    const s1 = document.getElementById('auth-step-1');
    const sp = document.getElementById('auth-step-password');
    const sc = document.getElementById('auth-step-customer');
    const sv = document.getElementById('auth-step-vendor');
    const backBtn = document.getElementById('auth-header-back-btn');
    const tag = document.getElementById('auth-modal-header-tag');

    if (s1) s1.style.display = 'none';
    if (sp) sp.style.display = 'none';
    if (sc) sc.style.display = 'none';
    if (sv) sv.style.display = 'block';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (tag) tag.textContent = 'Vendor Registration';

    // Default to physical store
    this.setVendorStoreType(this.vendorStoreType || 'physical');
    this.bindEmailInputs();

    setTimeout(() => {
      const storeInp = document.getElementById('auth-vnd-store-name');
      if (storeInp) storeInp.focus();
    }, 60);
  },

  // -------------------------------------------------------------
  // Vendor Store Type & Photo Upload
  // -------------------------------------------------------------
  setVendorStoreType(type) {
    this.vendorStoreType = type;
    const physCard = document.getElementById('type-card-physical');
    const onlineCard = document.getElementById('type-card-online');
    const uploadLabel = document.getElementById('auth-vnd-upload-label');
    const uploadHint = document.getElementById('auth-vnd-upload-hint');
    const dropzoneIcon = document.getElementById('auth-dropzone-icon');

    if (type === 'physical') {
      if (physCard) physCard.classList.add('selected');
      if (onlineCard) onlineCard.classList.remove('selected');
      if (uploadLabel) uploadLabel.textContent = 'Upload your store picture';
      if (uploadHint) uploadHint.textContent = 'Storefront, restaurant entrance, or kitchen photo';
      if (dropzoneIcon) dropzoneIcon.textContent = '🏪';
    } else {
      if (physCard) physCard.classList.remove('selected');
      if (onlineCard) onlineCard.classList.add('selected');
      if (uploadLabel) uploadLabel.textContent = 'Upload a food picture';
      if (uploadHint) uploadHint.textContent = 'Signature meal, packaged food dish, or menu special';
      if (dropzoneIcon) dropzoneIcon.textContent = '🍲';
    }
  },

  triggerPhotoSelect() {
    const fileInput = document.getElementById('auth-vnd-photo-input');
    if (fileInput) fileInput.click();
  },

  _compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        callback(dataUrl);
      };
      img.onerror = () => callback(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  handlePhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showAlert('vendor', 'Please select an image file (JPG, PNG, or WebP).');
      return;
    }

    this._compressImage(file, (dataUrl) => {
      this.uploadedPhotoDataUrl = dataUrl;
      const previewImg = document.getElementById('auth-vnd-photo-preview');
      const emptyBox = document.getElementById('auth-dropzone-empty');
      const previewBox = document.getElementById('auth-dropzone-preview');

      if (previewImg) previewImg.src = dataUrl;
      if (emptyBox) emptyBox.style.display = 'none';
      if (previewBox) previewBox.style.display = 'flex';
      this.clearAlerts();
      this.closeErrorPopup();
    });
  },

  resetPhotoUpload() {
    this.uploadedPhotoDataUrl = '';
    const fileInput = document.getElementById('auth-vnd-photo-input');
    if (fileInput) fileInput.value = '';

    const emptyBox = document.getElementById('auth-dropzone-empty');
    const previewBox = document.getElementById('auth-dropzone-preview');
    if (emptyBox) emptyBox.style.display = 'block';
    if (previewBox) previewBox.style.display = 'none';
  },

  /**
   * Fills an address field from the device's GPS position.
   *
   * Prefers a pin the user already dropped on the map, then browser geolocation
   * (reverse geocoded through Mapbox when a token is present), and finally falls
   * back to raw coordinates so the field is never left silently empty. Any
   * failure produces a message telling the user they can type the address
   * instead — manual entry is always available and always wins.
   */
  async _captureLiveLocation(inputId, label) {
    const addrInput = document.getElementById(inputId);
    if (!addrInput) return;

    const setAddr = (text, coords) => {
      addrInput.value = text;
      if (window.chowStore && window.chowStore.state) {
        window.chowStore.state.selectedLocation = {
          name: 'Current Location',
          formattedAddress: text,
          lat: coords ? coords.lat : null,
          lng: coords ? coords.lng : null,
          type: 'current',
          isUserSelected: true
        };
        if (typeof window.chowStore.save === 'function') window.chowStore.save();
      }
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Location captured. You can still edit the address.', 'success');
      }
    };

    // Only reuse an existing pin when the user actually chose a real street address.
    // Never reuse raw coordinate strings like "Lat: 6.5802...".
    const pinned = window.chowStore
      && window.chowStore.state
      && window.chowStore.state.selectedLocation;
    const pinIsUserChosen = pinned && (pinned.type === 'current' || pinned.isUserSelected);
    const existingAddr = pinned && (pinned.formattedAddress || pinned.name);
    const isCoordinateString = existingAddr && (/^lat[:\s]/i.test(existingAddr) || /^\d+\.\d+,\s*\d+\.\d+/.test(existingAddr));

    if (pinIsUserChosen && existingAddr && !isCoordinateString) {
      setAddr(existingAddr, { lat: pinned.lat, lng: pinned.lng });
      return;
    }

    if (!navigator.geolocation) {
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('This browser cannot share a live location. Type your address instead.', 'warning');
      }
      return;
    }

    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Getting your current street address...', 'info');
    }
    addrInput.value = 'Locating street address…';

    const handlePos = async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const streetText = await this._reverseGeocodeToStreet(lat, lng);

      setAddr(streetText, { lat, lng });
      if (label && window.chowApp && window.chowApp.toast) {
        const shortName = streetText.split(',')[0];
        window.chowApp.toast(`${label} set to ${shortName}`, 'success');
      }
    };

    navigator.geolocation.getCurrentPosition(
      handlePos,
      (err) => {
        // Fallback to standard accuracy
        navigator.geolocation.getCurrentPosition(
          handlePos,
          async (err2) => {
            try {
              const res = await fetch('https://ipwho.is/');
              if (res.ok) {
                const d = await res.json();
                if (d.success !== false && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
                  await handlePos({ coords: { latitude: d.latitude, longitude: d.longitude, accuracy: 2500 } });
                  return;
                }
              }
            } catch (e) {}
            addrInput.value = '';
            const denied = (err && err.code === 1) || (err2 && err2.code === 1);
            if (window.chowApp && window.chowApp.toast) {
              window.chowApp.toast(
                denied
                  ? 'Location permission denied. Type your address instead.'
                  : 'Could not get your location. Type your address instead.',
                'warning'
              );
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  },

  /**
   * Reverse geocodes coordinates to a human-readable street address.
   * Tries server route /api/geocode/reverse -> Mapbox -> OpenStreetMap Nominatim -> BigDataCloud.
   * Never falls back to raw latitude and longitude strings.
   */
  async _reverseGeocodeToStreet(lat, lng) {
    const isPlusCode = (s) => /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(\b|$)/i.test((s || '').trim());
    const cleanAddr = (s) => {
      if (!s) return '';
      return s.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(?:,\s*|\s+)?/i, '')
              .replace(/^\d{5,6}(?:,\s*|\s+)?/, '')
              .trim();
    };

    // 1. First priority: Server-side geocoding endpoint (zero CORS, server-side Mapbox + OSM)
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.address && !data.address.startsWith('Location near')) {
          const cleaned = cleanAddr(data.address) || data.address;
          return data.street && !isPlusCode(data.street) ? data.street : cleaned;
        }
      }
    } catch (e) {
      console.warn('[auth] Server reverse geocode error:', e);
    }

    // 2. Client Google Maps Geocoder if available
    if (window.google && window.google.maps) {
      try {
        const gRes = await new Promise((resolve) => {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && Array.isArray(results) && results.length > 0) {
              const best = results.find(r => r.types && !r.types.includes('plus_code') && !isPlusCode(r.formatted_address)) || results[0];
              const cleaned = cleanAddr(best.formatted_address) || best.formatted_address;
              resolve(cleaned);
            } else {
              resolve(null);
            }
          });
        });
        if (gRes) return gRes;
      } catch (e) {
        console.warn('[auth] Google Maps reverse geocode error:', e);
      }
    }

    // 2. Fallback to OpenStreetMap / Nominatim (free, detailed street names in Nigeria)
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(nomUrl, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const a = data.address || {};
        const parts = [];
        if (a.road || a.pedestrian) parts.push(a.road || a.pedestrian);
        if (a.neighbourhood && !parts.includes(a.neighbourhood)) parts.push(a.neighbourhood);
        if (a.suburb && !parts.includes(a.suburb)) parts.push(a.suburb);
        if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county);
        if (a.state) parts.push(a.state);
        if (a.country) parts.push(a.country);

        if (parts.length > 0) return parts.join(', ');
        if (data.display_name) return data.display_name;
      }
    } catch (e) {
      console.warn('Nominatim reverse geocode error:', e);
    }

    // 3. Fallback to BigDataCloud client API
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const res = await fetch(bdcUrl);
      if (res.ok) {
        const data = await res.json();
        const parts = [];
        if (data.locality) parts.push(data.locality);
        if (data.city && data.city !== data.locality) parts.push(data.city);
        if (data.principalSubdivision) parts.push(data.principalSubdivision);
        if (data.countryName) parts.push(data.countryName);
        if (parts.length > 0) return parts.join(', ');
      }
    } catch (e) {
      console.warn('BigDataCloud reverse geocode error:', e);
    }

    // 4. Fallback to closest known landmark from seed data
    if (typeof window.CHOW45_LOCATIONS !== 'undefined' && Array.isArray(window.CHOW45_LOCATIONS)) {
      let nearest = null;
      let minDist = Infinity;
      for (const loc of window.CHOW45_LOCATIONS) {
        const dLat = loc.lat - lat;
        const dLng = loc.lng - lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < minDist) {
          minDist = dist;
          nearest = loc;
        }
      }
      if (nearest && minDist < 0.15) {
        return `Near ${nearest.name}, ${nearest.city || 'Ogun'}`;
      }
    }

    return 'Current Location';
  },

  useCurrentLocationForCustomer() {
    return this._captureLiveLocation('auth-cust-address');
  },

  useCurrentLocationForVendor() {
    return this._captureLiveLocation('auth-vnd-address', 'Store pickup address');
  },

  /**
   * Loads the vendor's real profile from the server and paints the Store tab.
   *
   * Anything that cannot be loaded is left blank rather than filled with a
   * placeholder, so the vendor never mistakes sample data for their own.
   */
  async loadVendorProfile() {
    if (window.__chow45VendorProfileLoading) return;
    window.__chow45VendorProfileLoading = true;

    const nameEl = document.getElementById('vendor-store-name');
    const locEl = document.getElementById('vendor-store-location');
    const hoursEl = document.getElementById('vendor-store-hours');
    const avatarEl = document.getElementById('vendor-store-avatar');

    // A profile written during signup may not have reached the server yet.
    let pending = null;
    try {
      const raw = sessionStorage.getItem('chow45_vendor_pending_profile');
      if (raw) pending = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    let profile = null;
    let serverData = null;

    const store = (window.VendorController && window.VendorController.getStore)
      ? window.VendorController.getStore()
      : (window.chowStore?.getCurrentVendor ? window.chowStore.getCurrentVendor() : null);

    const sessionUser = this.getSession();
    const vendorEmail = (store && store.email) || sessionUser?.email || window.chowStore?.state?.userProfile?.email || '';

    const headers = { 'Content-Type': 'application/json' };
    if (store?.id) headers['x-vendor-store-id'] = String(store.id);
    if (store?.numericId) headers['x-vendor-id'] = String(store.numericId);
    if (vendorEmail) headers['x-vendor-email'] = String(vendorEmail);

    const params = new URLSearchParams();
    if (store?.id && !store.id.includes('-') === false) params.set('storeId', store.id);
    if (store?.numericId) params.set('vendorId', String(store.numericId));
    if (vendorEmail) params.set('email', vendorEmail);
    const qs = params.toString() ? `?${params.toString()}` : '';

    try {
      const res = await fetch(`/api/vendor/profile${qs}`, {
        headers,
        credentials: 'include'
      });
      if (res.ok) {
        serverData = await res.json().catch(() => ({}));
        profile = serverData && serverData.vendor ? serverData.vendor : null;
      } else if (res.status === 401) {
        console.warn('[auth] /api/vendor/profile returned 401, retaining local state.');
      }
    } catch (e) {
      // Offline or server down: fall back to whatever signup captured.
    }

    if (!profile && pending) profile = pending;

    if (profile) {
      if (nameEl) nameEl.textContent = profile.businessName || 'Your Store';
      if (locEl) {
        locEl.textContent = profile.address || 'No pickup address set yet';
      }
      if (hoursEl) {
        const oh = profile.operatingHours;
        hoursEl.textContent = (oh && (oh.display || oh.text))
          ? `🕐 ${oh.display || oh.text}`
          : '🕐 No opening hours set yet';
      }
      if (avatarEl) {
        if (profile.image) {
          avatarEl.src = profile.image;
          avatarEl.style.display = '';
        } else {
          avatarEl.style.display = 'none';
        }
      }

      // Sync resolved store details into store state
      if (window.chowStore?.state) {
        if (!window.chowStore.state.userProfile) window.chowStore.state.userProfile = {};
        window.chowStore.state.userProfile.storeId = profile.storeId;
        window.chowStore.state.userProfile.vendorId = profile.id;
        window.chowStore.state.userProfile.name = profile.businessName;
        if (profile.contactEmail && !window.chowStore.state.userProfile.email) {
          window.chowStore.state.userProfile.email = profile.contactEmail;
        }

        if (window.chowStore.state.vendorOnboarding) {
          window.chowStore.state.vendorOnboarding.storeId = profile.storeId;
          window.chowStore.state.vendorOnboarding.status = 'approved';
          window.chowStore.state.vendorOnboarding.storeName = profile.businessName;
        }

        // Link with existing store in restaurants list
        const rests = window.chowStore.state.restaurants || [];
        let matched = rests.find(r => r.id === profile.storeId || (r.numericId && r.numericId === profile.id));
        if (!matched && profile.contactEmail) {
          const ce = profile.contactEmail.toLowerCase();
          matched = rests.find(r => (r.email && r.email.toLowerCase() === ce) || (r.contactEmail && r.contactEmail.toLowerCase() === ce));
        }
        if (matched) {
          matched.id = profile.storeId;
          matched.numericId = profile.id;
          matched.name = profile.businessName;
          matched.address = profile.address || matched.address;
          matched.email = profile.contactEmail || matched.email;
          matched.contactEmail = profile.contactEmail || matched.contactEmail;
        } else {
          matched = {
            id: profile.storeId,
            numericId: profile.id,
            name: profile.businessName,
            address: profile.address || '',
            email: profile.contactEmail,
            contactEmail: profile.contactEmail,
            phone: profile.contactPhone || '',
            bannerImg: profile.image || profile.bannerImage || '',
            image: profile.image || '',
            open: true,
            isOpen: true,
            tags: ['Store', 'Campus Delivery'],
            menu: []
          };
          rests.unshift(matched);
        }
        window.chowStore.state.restaurants = rests;
        window.chowStore.save();

        // Also persist storeId and vendorId to the session storage so reloads know it immediately
        try {
          const rawS = localStorage.getItem(this.STORAGE_KEY);
          if (rawS) {
            const parsedS = JSON.parse(rawS);
            if (parsedS && parsedS.user) {
              parsedS.user.storeId = profile.storeId;
              parsedS.user.vendorId = profile.id;
              parsedS.user.name = profile.businessName;
              parsedS.user.role = 'vendor';
              localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsedS));
            }
          }
        } catch {}
      }

      // Refresh vendor dashboard views and sync menu items from server immediately
      if (typeof VendorController !== 'undefined') {
        if (VendorController.render) VendorController.render();
        if (VendorController.syncMenuFromServer) VendorController.syncMenuFromServer();
      }

      // Check one-time password and location setup for tolaniakin2022@gmail.com
      this.checkFirstTimeVendorSetup(profile, serverData);
    } else {
      if (nameEl) nameEl.textContent = 'Your Store';
      if (locEl) locEl.textContent = 'No pickup address set yet';
      if (hoursEl) hoursEl.textContent = '🕐 No opening hours set yet';
      if (avatarEl) avatarEl.style.display = 'none';

      // Also check setup if serverData indicates target user
      if (serverData?.requiresFirstTimeSetup || serverData?.userEmail === 'tolaniakin2022@gmail.com') {
        this.checkFirstTimeVendorSetup(profile, serverData);
      }
    }

    window.__chow45VendorProfileLoading = false;
  },

  // -------------------------------------------------------------
  // Submission Handlers
  // -------------------------------------------------------------
  async handleCustomerSubmit() {
    this.clearAlerts();
    const email = (document.getElementById('auth-cust-email')?.value || '').trim();
    const phone = (document.getElementById('auth-cust-phone')?.value || '').trim();
    const address = (document.getElementById('auth-cust-address')?.value || '').trim();
    const name = (document.getElementById('auth-cust-name')?.value || '').trim();
    const password = (document.getElementById('auth-cust-password')?.value || '').trim();
    const btn = document.getElementById('auth-cust-btn');

    if (!email || !email.includes('@')) {
      this.showAlert('customer', 'Please provide a valid email address.');
      return;
    }

    // Check if account already exists before trying to register
    const existingCustLookup = await this.checkEmailAccount(email);
    if (existingCustLookup && existingCustLookup.exists) {
      this.showPasswordStep(existingCustLookup.role || 'USER', email);
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Account already exists! Please enter your password to sign in.', 'info');
      }
      return;
    }

    if (!phone || phone.length < 9) {
      this.showAlert('customer', 'Please enter a valid phone number (at least 9 digits).');
      return;
    }
    if (!address || address.length < 3) {
      this.showAlert('customer', 'Please enter your delivery address.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving account...';
    }

    try {
      const displayName = name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      // Register with the server to create user and persist credentials
      try {
        const regRes = await fetch('/api/auth/customer/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: password || 'Chow45User!2026',
            name: displayName,
            phone,
            address
          })
        });
        if (!regRes.ok) {
          const errData = await regRes.json().catch(() => ({}));
          console.warn('[auth] Customer server registration warning:', errData.error);
        }
      } catch (srvErr) {
        console.warn('[auth] Customer registration network warning:', srvErr);
      }

      const userData = {
        name: displayName,
        email,
        phone,
        address,
        role: 'customer'
      };

      // Save address into profile's savedAddresses
      if (window.chowStore && window.chowStore.state && window.chowStore.state.userProfile) {
        const addresses = window.chowStore.state.userProfile.savedAddresses || [];
        if (!addresses.some(a => a.address === address || a.formattedAddress === address)) {
          addresses.unshift({
            id: 'addr-' + Date.now(),
            label: 'Home',
            address,
            formattedAddress: address
          });
          window.chowStore.state.userProfile.savedAddresses = addresses;
        }
      }

      this.completeLogin(userData);
      this.close();

      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast(`Welcome to Chow45, ${displayName.split(' ')[0]}!`, 'success');
      }
    } catch (err) {
      this.showAlert('customer', err.message || 'Could not complete registration. Please try again.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Start Ordering on Chow45 ✓';
      }
    }
  },

  async handleVendorSubmit() {
    this.clearAlerts();
    const email = (document.getElementById('auth-vnd-email')?.value || '').trim();
    const phone = (document.getElementById('auth-vnd-phone')?.value || '').trim();
    const storeName = (document.getElementById('auth-vnd-store-name')?.value || '').trim();
    const address = (document.getElementById('auth-vnd-address')?.value || '').trim();
    const password = (document.getElementById('auth-vnd-password')?.value || '').trim();
    const storeType = this.vendorStoreType;
    const btn = document.getElementById('auth-vnd-btn');

    if (!email || !email.includes('@')) {
      this.showAlert('vendor', 'Please provide a valid email address.');
      return;
    }

    // Check if account already exists before trying to register
    const existingVndLookup = await this.checkEmailAccount(email);
    if (existingVndLookup && existingVndLookup.exists) {
      this.showPasswordStep(existingVndLookup.role || 'VENDOR', email);
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Account already exists! Please enter your password to sign in.', 'info');
      }
      return;
    }
    if (!phone || phone.length < 9) {
      this.showAlert('vendor', 'Please enter a valid phone number.');
      return;
    }
    if (!storeName || storeName.length < 2) {
      this.showAlert('vendor', 'Please enter your restaurant or store name.');
      return;
    }
    if (!address) {
      this.showAlert('vendor', 'Please provide your store pickup address.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Registering kitchen...';
    }

    try {
      const photo = this.uploadedPhotoDataUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80';

      // Register with the server endpoint to create user, hash password, and create vendor row
      let serverVendor = null;
      let serverUser = null;
      try {
        const regRes = await fetch('/api/auth/vendor/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password: password || 'Chow45Vendor!2026',
            storeName,
            phone,
            address,
            storeType,
            image: photo
          })
        });

        const regData = await regRes.json().catch(() => ({}));
        if (regRes.ok && regData.success) {
          serverVendor = regData.vendor;
          serverUser = regData.user;
          // Auto-save credentials for smooth future logins
          this.saveCredentials(email, password || 'Chow45Vendor!2026', 'VENDOR');
        } else {
          const errMsg = regData.error || 'Could not register store on server. Please try again.';
          this.showAlert('vendor', errMsg);
          if (window.chowApp && window.chowApp.toast) {
            window.chowApp.toast(errMsg, 'error');
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Register Store & Start Selling ✓';
          }
          return;
        }
      } catch (srvErr) {
        console.warn('[auth] Vendor registration network warning:', srvErr);
        const errMsg = 'Network error while registering store. Please check your connection.';
        this.showAlert('vendor', errMsg);
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Register Store & Start Selling ✓';
        }
        return;
      }

      const storeId = serverVendor?.storeId || ('rest-' + storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20) + '-' + Date.now().toString().slice(-4));

      // The area picked in the onboarding gate becomes the store's zone.
      const zone = window.VendorOnboarding && window.VendorOnboarding.getZoneId
        ? window.VendorOnboarding.zoneInfo(window.VendorOnboarding.getZoneId())
        : null;

      const live = window.chowStore && window.chowStore.state && window.chowStore.state.selectedLocation;
      const liveCoords = live && live.type === 'current' && live.lat && live.lng
        ? { lat: live.lat, lng: live.lng }
        : null;

      const newStore = {
        id: storeId,
        numericId: serverVendor?.id || undefined,
        name: storeName,
        storeType: storeType === 'physical' ? 'Physical Restaurant' : 'Online Kitchen',
        address: address,
        latitude: liveCoords ? liveCoords.lat : null,
        longitude: liveCoords ? liveCoords.lng : null,
        phone: phone,
        email: email,
        banner: photo,
        avatar: photo,
        rating: 0,
        prepTime: '20-30 mins',
        tags: [storeType === 'physical' ? 'Restaurant' : 'Cloud Kitchen', 'Campus Delivery'],
        isOpen: true,
        zoneId: zone ? zone.id : null,
        zoneName: zone ? zone.label : null,
        zoneArea: zone ? zone.area : null,
        menu: []
      };

      // Add to restaurants in state
      if (window.chowStore && window.chowStore.state) {
        if (!window.chowStore.state.restaurants) window.chowStore.state.restaurants = [];
        window.chowStore.state.restaurants.unshift(newStore);
        if (window.chowStore.state.vendorOnboarding) {
          window.chowStore.state.vendorOnboarding.storeId = storeId;
          window.chowStore.state.vendorOnboarding.status = 'approved';
        }
      }

      const userData = {
        name: storeName,
        email,
        phone,
        role: 'vendor',
        vendorId: serverVendor?.id || undefined,
        storeId,
        storeType
      };

      this.completeLogin(userData);
      this.close();

      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast(`🎉 Store registered! Redirecting to Vendor Dashboard...`, 'success');
      }

      // Switch role & redirect directly to the vendor dashboard
      if (window.chowApp && window.chowApp.switchRole) {
        window.chowApp.switchRole('vendor');
      }

      setTimeout(() => {
        if (!window.location.pathname.startsWith('/vendor')) {
          window.location.href = '/vendor';
        } else {
          window.location.reload();
        }
      }, 350);
    } catch (err) {
      this.showAlert('vendor', err.message || 'Could not register store. Please try again.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Register Store & Start Selling ✓';
      }
    }
  },

  completeLogin(userData) {
    const session = {
      token: 'chow45_session_' + Date.now(),
      user: {
        id: userData.id || userData.userId || undefined,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role || 'customer',
        address: userData.address || '',
        image: userData.image || userData.avatar || userData.picture || undefined,
        avatar: userData.avatar || userData.image || userData.picture || undefined,
        vendorId: userData.vendorId || undefined,
        storeId: userData.storeId || undefined,
        storeType: userData.storeType || undefined,
        isLoggedIn: true
      },

      createdAt: new Date().toISOString()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    try {
      localStorage.setItem('chow45_user', JSON.stringify(session.user));
    } catch {}

    if (window.chowStore && window.chowStore.state) {
      if (typeof window.chowStore.ensureUserProfileIntegrity === 'function') {
        window.chowStore.ensureUserProfileIntegrity();
      }
      window.chowStore.state.userProfile = Object.assign(
        {},
        window.chowStore.state.userProfile || {},
        session.user
      );
      if (typeof window.chowStore.ensureUserProfileIntegrity === 'function') {
        window.chowStore.ensureUserProfileIntegrity();
      }
      if (session.user.role === 'vendor' && session.user.storeId) {
        if (!window.chowStore.state.vendorOnboarding) window.chowStore.state.vendorOnboarding = {};
        window.chowStore.state.vendorOnboarding.storeId = session.user.storeId;
        window.chowStore.state.vendorOnboarding.status = 'approved';
        window.chowStore.state.vendorOnboarding.storeName = session.user.name;
      }
      window.chowStore.save();
    }

    this.updateUI();

    // The vendor onboarding gate must not sit on top of the dashboard.
    if (window.VendorOnboarding && typeof window.VendorOnboarding.onAuthenticated === 'function') {
      window.VendorOnboarding.onAuthenticated();
    }
  },

  getSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.user || parsed;
      }
    } catch {}
    return null;
  },

  async signOut() {
    try {
      await Promise.allSettled([
        fetch('/api/auth/vendor/sign-out', { method: 'POST', credentials: 'include' }),
        fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
      ]);
    } catch (e) {
      console.warn('[auth] sign-out request failed:', e);
    }

    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem('chow45_vendor_trigger_setup');

    if (window.chowStore && window.chowStore.state) {
      window.chowStore.state.userProfile = {
        isLoggedIn: false,
        name: 'Guest',
        phone: '',
        email: '',
        role: 'customer'
      };
      window.chowStore.save();
    }
    try { localStorage.removeItem('chow45_user'); } catch {}

    this.close();
    this.updateUI();

    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Signed out successfully', 'info');
    }

    setTimeout(() => {
      window.location.href = '/app';
    }, 250);
  },

  updateUI() {
    const user = this.getUser();
    const navBtn = document.getElementById('nav-auth-btn');
    if (!navBtn) return;

    const labelEl = navBtn.querySelector('.nav-auth-label');
    const iconEl = navBtn.querySelector('.nav-auth-icon');

    if (user && user.isLoggedIn) {
      const firstName = (user.name || 'User').split(' ')[0];
      if (labelEl) labelEl.textContent = firstName;

      const avatarUrl = user.image || user.avatar || user.picture;
      const initial = (user.name || user.email || 'U').trim().charAt(0).toUpperCase() || 'U';

      if (avatarUrl && typeof avatarUrl === 'string' && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'))) {
        if (iconEl) {
          iconEl.innerHTML = `<img src="${avatarUrl}" alt="${user.name || 'Profile'}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; display: inline-block; vertical-align: middle;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'width:22px;height:22px;border-radius:50%;background:#008751;color:#fff;font-size:0.72rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;text-transform:uppercase;\\'>${initial}</span>';" />`;
        }
      } else {
        if (iconEl) {
          iconEl.innerHTML = `<span style="width: 22px; height: 22px; border-radius: 50%; background: #008751; color: #fff; font-size: 0.72rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; text-transform: uppercase;">${initial}</span>`;
        }
      }

      navBtn.title = `Signed in as ${user.name} (Click for Account)`;
      navBtn.classList.add('logged-in');
    } else {
      if (labelEl) labelEl.textContent = 'Sign In';
      if (iconEl) iconEl.textContent = '👤';
      navBtn.title = 'Sign In or Create Account';
      navBtn.classList.remove('logged-in');
    }


    // Auto-fill checkout fields if user is logged in
    const checkoutName = document.getElementById('checkout-name-input');
    const checkoutPhone = document.getElementById('checkout-phone-input');
    const checkoutAddr = document.getElementById('checkout-address-input');
    if (user && user.isLoggedIn) {
      if (checkoutName && !checkoutName.value) checkoutName.value = user.name || '';
      if (checkoutPhone && !checkoutPhone.value) checkoutPhone.value = user.phone || '';
      if (checkoutAddr && !checkoutAddr.value && user.address) checkoutAddr.value = user.address;
    }
  },

  clearAlerts() {
    ['auth-step1-alert', 'auth-password-alert', 'auth-cust-alert', 'auth-vnd-alert'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
  },

  showAlert(step, message, options = {}) {
    const alertIdMap = {
      step1: 'auth-step1-alert',
      password: 'auth-password-alert',
      customer: 'auth-cust-alert',
      vendor: 'auth-vnd-alert'
    };
    const el = document.getElementById(alertIdMap[step] || alertIdMap.vendor);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }

    // Sign-in errors are shown inline only. The blocking popup is reserved for
    // onboarding problems (missing photo, phone, address) that need attention.
    if (options.inlineOnly) return;

    // Determine context for error popup
    let icon = '⚠️';
    let title = 'Action Required';
    let isPhotoError = false;

    const lower = (message || '').toLowerCase();
    if (lower.includes('picture') || lower.includes('photo')) {
      icon = '📸';
      title = 'Picture Required';
      isPhotoError = true;
    } else if (lower.includes('email')) {
      icon = '✉️';
      title = 'Email Required';
    } else if (lower.includes('phone')) {
      icon = '📱';
      title = 'Phone Number Required';
    } else if (lower.includes('address')) {
      icon = '📍';
      title = 'Address Required';
    } else if (lower.includes('store name') || lower.includes('restaurant')) {
      icon = '🏪';
      title = 'Store Name Required';
    }

    this.showErrorPopup(message, Object.assign({ icon, title, isPhotoError }, options));
  },

  showErrorPopup(message, options = {}) {
    const popup = document.getElementById('auth-error-popup');
    const msgEl = document.getElementById('auth-popup-message');
    const titleEl = document.getElementById('auth-popup-title');
    const iconEl = document.getElementById('auth-popup-icon');
    const actionsEl = document.getElementById('auth-popup-actions');

    const title = options.title || 'Action Required';
    const icon = options.icon || '⚠️';

    if (popup && msgEl) {
      msgEl.textContent = message;
      if (titleEl) titleEl.textContent = title;
      if (iconEl) iconEl.textContent = icon;

      if (actionsEl) {
        if (options.isPhotoError) {
          actionsEl.innerHTML = `
            <button type="button" class="auth-popup-btn auth-popup-btn-upload" onclick="Chow45Auth.triggerUploadFromPopup()">📸 Choose Picture Now</button>
            <button type="button" class="auth-popup-btn auth-popup-btn-dismiss" onclick="Chow45Auth.closeErrorPopup()">Close</button>
          `;
        } else {
          actionsEl.innerHTML = `
            <button type="button" class="auth-popup-btn primary" onclick="Chow45Auth.closeErrorPopup()">Okay, Got It</button>
          `;
        }
      }

      popup.style.display = 'flex';
      void popup.offsetWidth;
      popup.classList.add('open');

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(80); } catch (e) {}
      }
    } else {
      alert(message);
    }
  },

  closeErrorPopup() {
    const popup = document.getElementById('auth-error-popup');
    if (popup) {
      popup.classList.remove('open');
      setTimeout(() => {
        popup.style.display = 'none';
      }, 200);
    }
  },

  triggerUploadFromPopup() {
    this.closeErrorPopup();
    setTimeout(() => {
      this.triggerPhotoSelect();
    }, 120);
  },

  onBackdropErrorPopupClick(event) {
    if (event.target && event.target.id === 'auth-error-popup') {
      this.closeErrorPopup();
    }
  },

  togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  },

  toggleSetupPasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  },

  checkFirstTimeVendorSetup(profile, serverData) {
    const session = this.getSession();
    const email = (
      session?.email ||
      serverData?.userEmail ||
      profile?.contactEmail ||
      window.chowStore?.state?.userProfile?.email ||
      ''
    ).toLowerCase().trim();

    const tags = profile?.tags || serverData?.vendor?.tags || [];
    const isTarget = email === 'tolaniakin2022@gmail.com';
    const hasChanged = Array.isArray(tags) && (tags.includes('first_time_setup_done') || tags.includes('password_changed'));
    const explicitlyFlagged = Array.isArray(tags) && tags.includes('must_change_password');

    const needsPasswordChange =
      explicitlyFlagged ||
      (isTarget && !hasChanged) ||
      serverData?.requiresPasswordChange === true ||
      serverData?.requiresFirstTimeSetup === true;

    if (!needsPasswordChange) {
      this._unlockVendorDashboard();
      return;
    }

    const modal = document.getElementById('vendor-first-setup-modal');
    if (!modal) return;

    // Suppress/close lower-priority popups that might obscure or confuse the view
    this.closeErrorPopup();

    // Lock body scrolling and mark vendor dashboard inert
    document.body.classList.add('vendor-password-locked');
    const view = document.getElementById('view-vendor');
    if (view) {
      view.setAttribute('inert', '');
      view.setAttribute('aria-hidden', 'true');
    }

    // Immediately display the modal above all layers
    modal.style.display = 'flex';
    modal.classList.add('open');
  },

  _unlockVendorDashboard() {
    document.body.classList.remove('vendor-password-locked');
    const view = document.getElementById('view-vendor');
    if (view) {
      view.removeAttribute('inert');
      view.removeAttribute('aria-hidden');
    }
    const modal = document.getElementById('vendor-first-setup-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = 'none';
    }
  },

  closeFirstTimeSetup() {
    // Zero bypass: Mandatory password change cannot be closed or dismissed!
    console.warn('[Chow45Auth] Password change is mandatory and cannot be dismissed.');
  },

  async submitFirstTimeSetup() {
    const pw = (document.getElementById('vnd-setup-password')?.value || '').trim();
    const confirm = (document.getElementById('vnd-setup-password-confirm')?.value || '').trim();
    const errEl = document.getElementById('vnd-setup-error');
    const btn = document.getElementById('vnd-setup-submit-btn');

    const showError = (msg) => {
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
    };

    if (errEl) errEl.style.display = 'none';

    if (!pw || pw.length < 6) {
      showError('Please choose a password with at least 6 characters.');
      return;
    }

    if (pw !== confirm) {
      showError('Passwords do not match. Please re-enter.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Updating Password...';
    }

    try {
      const session = this.getSession();
      const email = (
        session?.email ||
        window.chowStore?.state?.userProfile?.email ||
        'tolaniakin2022@gmail.com'
      ).toLowerCase().trim();

      const res = await fetch('/api/vendor/first-login-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || 'tolaniakin2022@gmail.com',
          newPassword: pw,
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        showError(data.error || 'Failed to update password. Please try again.');
        return;
      }

      // Mark completed permanently in storage
      localStorage.setItem(`chow45_first_setup_done_${email}`, 'true');
      sessionStorage.removeItem('chow45_vendor_trigger_setup');
      sessionStorage.removeItem('chow45_vendor_setup_dismissed');

      // Update saved credentials for seamless future auto-fills
      this.saveCredentials(email, pw, 'VENDOR');

      // Unlock dashboard and close modal
      this._unlockVendorDashboard();

      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('🎉 Password updated successfully! Welcome to your dashboard.', 'success');
      }

      // Refresh vendor dashboard views now that password change requirement is resolved
      if (typeof VendorController !== 'undefined') {
        if (VendorController.render) VendorController.render();
        if (VendorController.syncMenuFromServer) VendorController.syncMenuFromServer();
      }
    } catch (e) {
      showError('Network error. Please check your connection and try again.');
    } finally {
      if (btn) {
        btn.disabled = false;
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Update Password & Continue ➔';
      }
    }
  }
};

// Global trap: Prevent Escape key from dismissing the mandatory vendor password modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('vendor-first-setup-modal');
    if (modal && modal.classList.contains('open')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);

window.Chow45Auth = Chow45Auth;
