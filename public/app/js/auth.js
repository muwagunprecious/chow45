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
    this.updateUI();
  },

  restoreSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.user) {
          if (window.chowStore && window.chowStore.state) {
            window.chowStore.state.userProfile = Object.assign(
              {},
              window.chowStore.state.userProfile || {},
              session.user,
              { isLoggedIn: true }
            );
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
   * @param {'vendor'} [intent] Marks where the flow was started from, so an
   *   unknown email opens vendor registration instead of customer sign-up.
   */
  open(intent) {
    if (this.isLoggedIn()) {
      this.openAccountModal();
      return;
    }

    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    this.showStep1();
    // Set after showStep1, which resets the intent.
    this.intent = intent || null;
    modal.classList.add('open');
  },

  close() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.classList.remove('open');

    const accountModal = document.getElementById('account-modal');
    if (accountModal) accountModal.classList.remove('open');
  },

  openAccountModal() {
    const modal = document.getElementById('account-modal');
    if (!modal) return;

    const user = this.getUser();
    const nameEl = document.getElementById('account-display-name');
    const emailEl = document.getElementById('account-display-email');
    const phoneEl = document.getElementById('account-display-phone');
    const badgeEl = document.getElementById('account-role-badge');
    const avatarEl = document.getElementById('account-avatar-char');
    const locsCountEl = document.getElementById('account-locations-count');

    if (nameEl) nameEl.textContent = user.name || 'Chow45 Customer';
    if (emailEl) emailEl.textContent = user.email || 'customer@chow45.com';
    if (phoneEl) phoneEl.textContent = user.phone || '+234 812 450 4500';
    if (badgeEl) {
      badgeEl.textContent = user.role === 'vendor' ? 'Food Vendor' : 'Customer';
      badgeEl.className = `account-badge ${user.role === 'vendor' ? 'vendor' : 'customer'}`;
    }
    if (avatarEl) {
      const initial = (user.name || 'C').trim().charAt(0).toUpperCase();
      avatarEl.textContent = initial || 'C';
    }

    if (locsCountEl && user.savedAddresses) {
      const count = user.savedAddresses.length;
      locsCountEl.textContent = count > 0 ? `${count} saved location${count > 1 ? 's' : ''}` : 'Set Campus, Home & Work';
    }

    const vendorBtn = document.getElementById('account-vendor-dash-btn');
    if (vendorBtn) {
      vendorBtn.style.display = user.role === 'vendor' ? 'flex' : 'none';
    }

    modal.classList.add('open');
  },

  // -------------------------------------------------------------
  // Step Navigation
  // -------------------------------------------------------------
  showStep1() {
    this.currentStep = 'step1';
    this.pendingRole = null;
    this.intent = null;
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

    setTimeout(() => {
      const inp = document.getElementById('auth-step1-email');
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
      this.showPasswordStep(lookup.role, email);
      return;
    }

    // A visitor who arrived through the vendor gate is signing up to sell, so
    // an unknown email belongs in vendor registration, not customer sign-up.
    if (this.intent === 'vendor') {
      this.showVendorStep();
      return;
    }

    this.showCustomerStep();
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
    const pwField = document.getElementById('auth-password');
    const subheading = document.getElementById('auth-password-subheading');

    if (s1) s1.style.display = 'none';
    if (sp) sp.style.display = 'block';
    if (sc) sc.style.display = 'none';
    if (sv) sv.style.display = 'none';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (tag) tag.textContent = 'Sign In';

    if (emailField) emailField.value = email || '';
    if (pwField) pwField.value = '';
    if (subheading) {
      subheading.textContent = this.pendingRole === 'VENDOR'
        ? 'Enter your password to reach your vendor dashboard.'
        : 'Enter your password to continue.';
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
        let message = 'Incorrect email or password. Please try again.';
        try {
          const body = await res.json();
          if (body?.message && !/invalid/i.test(body.message)) message = body.message;
        } catch { /* keep the default message */ }
        this.showAlert('password', message, { inlineOnly: true });
        return;
      }

      // Reflect the signed-in user locally so the shell renders correctly if
      // the destination page is ever loaded without a full reload.
      let name = email.split('@')[0];
      try {
        const body = await res.json();
        if (body?.user?.name) name = body.user.name;
      } catch { /* fall back to the email local-part */ }

      this.completeLogin({ name, email, role: role === 'VENDOR' ? 'vendor' : 'customer' });
      this.close();

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

  showCustomerStep() {
    this.currentStep = 'customer';
    this.clearAlerts();

    const s1 = document.getElementById('auth-step-1');
    const sc = document.getElementById('auth-step-customer');
    const sv = document.getElementById('auth-step-vendor');
    const backBtn = document.getElementById('auth-header-back-btn');
    const tag = document.getElementById('auth-modal-header-tag');

    if (s1) s1.style.display = 'none';
    if (sc) sc.style.display = 'block';
    if (sv) sv.style.display = 'none';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (tag) tag.textContent = 'Complete Profile';

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

  showVendorStep() {
    this.currentStep = 'vendor';
    this.clearAlerts();

    // Transfer any email entered in step 1 if present
    const step1Email = document.getElementById('auth-step1-email')?.value?.trim();
    const vndEmail = document.getElementById('auth-vnd-email');
    if (vndEmail && step1Email) {
      vndEmail.value = step1Email;
    }

    const s1 = document.getElementById('auth-step-1');
    const sc = document.getElementById('auth-step-customer');
    const sv = document.getElementById('auth-step-vendor');
    const backBtn = document.getElementById('auth-header-back-btn');
    const tag = document.getElementById('auth-modal-header-tag');

    if (s1) s1.style.display = 'none';
    if (sc) sc.style.display = 'none';
    if (sv) sv.style.display = 'block';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (tag) tag.textContent = 'Vendor Registration';

    // Default to physical store
    this.setVendorStoreType(this.vendorStoreType || 'physical');

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

  useCurrentLocationForCustomer() {
    const addrInput = document.getElementById('auth-cust-address');
    if (!addrInput) return;

    if (window.chowStore && window.chowStore.state && window.chowStore.state.selectedLocation) {
      const loc = window.chowStore.state.selectedLocation;
      addrInput.value = loc.formattedAddress || loc.name || 'OOU Campus, Ago-Iwoye';
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Location applied from active map pin', 'info');
      }
    }
  },

  useCurrentLocationForVendor() {
    const addrInput = document.getElementById('auth-vnd-address');
    if (!addrInput) return;

    if (window.chowStore && window.chowStore.state && window.chowStore.state.selectedLocation) {
      const loc = window.chowStore.state.selectedLocation;
      addrInput.value = loc.formattedAddress || loc.name || 'Ago-Iwoye, Ogun State';
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Store pickup address set from map pin', 'info');
      }
    }
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
    if (!phone || phone.length < 9) {
      this.showAlert('vendor', 'Please enter a valid phone number.');
      return;
    }
    if (!storeName || storeName.length < 2) {
      this.showAlert('vendor', 'Please enter your restaurant or store name.');
      return;
    }
    if (!this.uploadedPhotoDataUrl) {
      const typeText = storeType === 'physical' ? 'store picture' : 'food picture';
      this.showAlert('vendor', `Please upload your ${typeText} to continue.`);
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
      const storeId = 'rest-' + storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20) + '-' + Date.now().toString().slice(-4);
      const photo = this.uploadedPhotoDataUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80';

      // The area picked in the onboarding gate becomes the store's zone.
      const zone = window.VendorOnboarding && window.VendorOnboarding.getZoneId
        ? window.VendorOnboarding.zoneInfo(window.VendorOnboarding.getZoneId())
        : null;

      const newStore = {
        id: storeId,
        name: storeName,
        storeType: storeType === 'physical' ? 'Physical Restaurant' : 'Online Kitchen',
        address: address,
        phone: phone,
        email: email,
        banner: photo,
        avatar: photo,
        rating: 5.0,
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
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role || 'customer',
        address: userData.address || '',
        isLoggedIn: true
      },
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));

    if (window.chowStore && window.chowStore.state) {
      window.chowStore.state.userProfile = Object.assign(
        {},
        window.chowStore.state.userProfile || {},
        session.user
      );
      if (window.chowStore.saveState) {
        window.chowStore.saveState();
      }
    }

    this.updateUI();

    // The vendor onboarding gate must not sit on top of the dashboard.
    if (window.VendorOnboarding && typeof window.VendorOnboarding.onAuthenticated === 'function') {
      window.VendorOnboarding.onAuthenticated();
    }
  },

  signOut() {
    localStorage.removeItem(this.STORAGE_KEY);

    if (window.chowStore && window.chowStore.state && window.chowStore.state.userProfile) {
      window.chowStore.state.userProfile.isLoggedIn = false;
      if (window.chowStore.saveState) {
        window.chowStore.saveState();
      }
    }

    this.close();
    this.updateUI();

    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Signed out successfully', 'info');
    }
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
      if (iconEl) iconEl.textContent = '👤';
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
  }
};

window.Chow45Auth = Chow45Auth;
