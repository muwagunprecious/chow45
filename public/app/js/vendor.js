/**
 * CHOW45 VENDOR PORTAL CONTROLLER
 * 4-step onboarding, menu + extras management, live order monitoring
 * (New / Preparing / Completed tabs with audible alerts), and simple
 * payouts & withdrawals.
 */

const VendorController = {
  currentStoreId: 'rest-mama-t',
  activeTab: 'new', // 'new' | 'preparing' | 'complete'
  activeSubTab: 'food', // 'food' | 'orders' | 'money' | 'home' | 'store'
  activeCategoryFilter: 'all',
  regStep: 1,
  foodDraft: null,
  flowStep: 1,
  flowDraft: null,
  pendingExtraType: 'REQUIRED',
  appDraft: {
    bannerDataUrl: null,
    pickupLocation: null // { latitude, longitude, address, formattedAddress }
  },
  notifiedOrderIds: new Set(),

  placeholderImg: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=80',

  init() {
    // Re-render on every state save (polling/live-sync behaviour).
    window.chowStore.subscribe(() => this.render());
    // Cross-tab "realtime": another tab saving state triggers this.
    window.addEventListener('storage', () => this.render());

    const bannerInput = document.getElementById('v-reg-banner-input');
    if (bannerInput) bannerInput.addEventListener('change', e => this._readFile(e.target, dataUrl => {
      this.appDraft.bannerDataUrl = dataUrl;
      const preview = document.getElementById('v-reg-banner-preview');
      const pick = document.getElementById('v-reg-banner-pick');
      const changeBtn = document.getElementById('v-reg-banner-change');
      if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
      if (pick) pick.style.display = 'none';
      if (changeBtn) changeBtn.style.display = 'inline-block';
    }));

    // Food Flow Photo Input (supports all image extensions: png, jpg, webp, svg, avif, heic, gif, bmp, etc.)
    const flowFileInput = document.getElementById('vnd-flow-file-input');
    if (flowFileInput) {
      flowFileInput.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const errEl = document.getElementById('vnd-photo-error-message');
        if (errEl) errEl.style.display = 'none';

        const emptyTitle = document.querySelector('#vnd-photo-empty-state .vnd-photo-title');
        const prevTitle = emptyTitle ? emptyTitle.innerText : 'Add food photo';
        if (emptyTitle) emptyTitle.innerText = 'Optimizing image...';

        this._compressImage(
          file,
          dataUrl => {
            if (emptyTitle) emptyTitle.innerText = prevTitle;
            if (this.flowDraft) {
              this.flowDraft.image = dataUrl;
              this.saveDraft(this.flowDraft);
            }
            const preview = document.getElementById('vnd-flow-photo-preview');
            const previewWrap = document.getElementById('vnd-photo-preview-wrap');
            const emptyState = document.getElementById('vnd-photo-empty-state');
            if (preview) preview.src = dataUrl;
            if (previewWrap) previewWrap.style.display = 'block';
            if (emptyState) emptyState.style.display = 'none';
            if (errEl) errEl.style.display = 'none';
          },
          errorMsg => {
            if (emptyTitle) emptyTitle.innerText = prevTitle;
            if (errEl) {
              errEl.innerText = errorMsg;
              errEl.style.display = 'block';
            }
            if (window.chowApp && window.chowApp.toast) {
              window.chowApp.toast(errorMsg, 'error');
            }
          }
        );
        e.target.value = '';
      });
    }

    this.render();
  },

  /** Universal image processor supporting any picture extension with downscaling & error detection */
  _compressImage(file, callback, errorCallback) {
    if (!file) {
      if (errorCallback) errorCallback('No file selected.');
      return;
    }

    // Limit maximum file size to 30MB
    if (file.size > 30 * 1024 * 1024) {
      const msg = 'Image file exceeds 30MB. Please choose a slightly smaller picture.';
      if (errorCallback) errorCallback(msg);
      return;
    }

    const name = file.name || '';
    const ext = name.split('.').pop()?.toLowerCase();
    const supportedExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif', 'heic', 'heif', 'jfif', 'tif', 'tiff', 'ico', 'pjpeg', 'pjp'];

    if (ext && !supportedExts.includes(ext) && !file.type.startsWith('image/')) {
      const msg = `Unsupported file format .${ext}. Please choose a valid picture (.png, .jpg, .webp, .svg, .gif, etc.).`;
      if (errorCallback) errorCallback(msg);
      return;
    }

    // Vector SVGs can be used directly without rasterization
    if (file.type === 'image/svg+xml' || ext === 'svg') {
      const reader = new FileReader();
      reader.onload = () => callback(reader.result);
      reader.onerror = () => {
        if (errorCallback) errorCallback('Failed to read SVG image file.');
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      const msg = 'Unable to read the image file from your device. Please try another photo.';
      if (errorCallback) errorCallback(msg);
    };

    reader.onload = (e) => {
      const resultDataUrl = e.target.result;
      const img = new Image();

      img.onerror = () => {
        // Fallback: If canvas decode fails, pass data URL directly if valid
        if (resultDataUrl && typeof resultDataUrl === 'string' && resultDataUrl.startsWith('data:image/')) {
          callback(resultDataUrl);
        } else if (errorCallback) {
          errorCallback('Could not decode image format. Please convert to PNG or JPG.');
        }
      };

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800; // Optimal resolution for clear food photos & fast transmission
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

          const isPng = file.type === 'image/png' || ext === 'png';
          if (!isPng) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Output png for PNGs with possible transparency, and high quality jpeg for others
          const mime = isPng ? 'image/png' : 'image/jpeg';
          const quality = isPng ? undefined : 0.84;
          const dataUrl = canvas.toDataURL(mime, quality);
          callback(dataUrl);
        } catch (canvasErr) {
          // If canvas tainted, fallback to direct data URL
          callback(resultDataUrl);
        }
      };

      img.src = resultDataUrl;
    };

    reader.readAsDataURL(file);
  },

  _readFile(input, callback) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => callback(reader.result);
    reader.readAsDataURL(file);
    input.value = '';
  },

  _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  _naira(n) {
    return `₦${(Number(n) || 0).toLocaleString()}`;
  },

  // ---------------------------------------------------------------
  // Store resolution & onboarding gating
  // ---------------------------------------------------------------
  getOnboarding() {
    return window.chowStore.state.vendorOnboarding || { status: 'approved', storeId: 'rest-mama-t' };
  },

  /**
   * The store the signed-in vendor is looking at.
   *
   * Only ever their own store. There is deliberately no "fall back to the first
   * restaurant in the seed list" branch: that handed the vendor Mama T's
   * Kitchen, so someone signing up saw another business's name, address and
   * hours. With no store of their own the dashboard renders an empty profile
   * rather than sample data.
   */
  getStore() {
    const ob = this.getOnboarding();
    const userProfile = window.chowStore?.state?.userProfile;
    const restaurants = window.chowStore?.state?.restaurants || [];

    // 1. Try matching by storeId from userProfile or onboarding
    const targetStoreId = userProfile?.storeId || ob?.storeId;
    if (targetStoreId) {
      const found = restaurants.find(r => r.id === targetStoreId);
      if (found) return found;
    }

    // 2. Try matching by vendor email
    const vendorEmail = userProfile?.email || ob?.email;
    if (vendorEmail) {
      const cleanEmail = vendorEmail.trim().toLowerCase();
      const found = restaurants.find(r => 
        (r.email && r.email.toLowerCase() === cleanEmail) ||
        (r.ownerEmail && r.ownerEmail.toLowerCase() === cleanEmail) ||
        (r.contactEmail && r.contactEmail.toLowerCase() === cleanEmail)
      );
      if (found) return found;

      // User is signed in as a vendor with their own email! Synthesize their own store
      const storeId = userProfile?.storeId || ob?.storeId || ('rest-' + cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36).slice(-4));
      const storeName = userProfile?.name || ob?.storeName || (cleanEmail.split('@')[0] + "'s Kitchen");
      const storeAddr = userProfile?.storeAddress || userProfile?.address || ob?.storeAddress || 'Hospital Road, Sagamu, Ogun State';
      const newStore = {
        id: storeId,
        numericId: userProfile?.vendorId || undefined,
        name: storeName,
        address: storeAddr,
        email: cleanEmail,
        phone: userProfile?.phone || ob?.phone || '',
        bannerImg: '',
        openingTime: '08:00',
        closingTime: '21:00',
        isOpen: true,
        menu: []
      };

      if (window.chowStore?.state) {
        if (!window.chowStore.state.restaurants) window.chowStore.state.restaurants = [];
        window.chowStore.state.restaurants.unshift(newStore);
        if (window.chowStore.state.vendorOnboarding) {
          window.chowStore.state.vendorOnboarding.storeId = storeId;
          window.chowStore.state.vendorOnboarding.status = 'approved';
        }
        window.chowStore.save();
      }
      return newStore;
    }

    // 3. Try matching by store name if userProfile.role === 'vendor'
    if (userProfile?.role === 'vendor' && userProfile?.name) {
      const found = restaurants.find(r => r.name && r.name.toLowerCase() === userProfile.name.toLowerCase());
      if (found) return found;
    }

    // 4. If any restaurant exists in chowStore, and no user email is set:
    if (restaurants.length > 0) {
      return restaurants[0];
    }

    // 5. If restaurants list is empty, synthesize a store for the vendor so they are NEVER blocked!
    const storeId = targetStoreId || ('rest-' + Date.now());
    const storeName = userProfile?.name || ob?.storeName || 'My Restaurant';
    const storeAddr = userProfile?.storeAddress || userProfile?.address || ob?.storeAddress || 'Hospital Road, Sagamu, Ogun State';
    const newStore = {
      id: storeId,
      name: storeName,
      address: storeAddr,
      email: vendorEmail || '',
      phone: userProfile?.phone || ob?.phone || '',
      bannerImg: '',
      openingTime: '08:00',
      closingTime: '21:00',
      isOpen: true,
      menu: []
    };
    if (window.chowStore?.state) {
      if (!window.chowStore.state.restaurants) window.chowStore.state.restaurants = [];
      window.chowStore.state.restaurants.push(newStore);
      if (window.chowStore.state.vendorOnboarding) {
        window.chowStore.state.vendorOnboarding.storeId = storeId;
        window.chowStore.state.vendorOnboarding.status = 'approved';
      }
      window.chowStore.save();
    }
    return newStore;
  },

  /**
   * Placeholder used while the real store has not loaded yet. Rendered as an
   * explicit "not set" state, never as someone else's business.
   */
  emptyStore() {
    return {
      id: null,
      name: 'Your Store',
      address: '',
      openingTime: '',
      closingTime: '',
      bannerImg: '',
      menu: []
    };
  },

  isLive() {
    return true;
  },

  getSavedDraft() {
    try {
      const raw = localStorage.getItem('chow45_vendor_food_draft');
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (draft && (draft.name || draft.platePrice || draft.scoopPrice || draft.piecePrice || draft.desc || draft.image)) {
        return draft;
      }
      return null;
    } catch {
      return null;
    }
  },

  saveDraft(draftData) {
    if (!draftData) return;
    try {
      const payload = Object.assign({}, draftData, { lastSaved: Date.now() });
      localStorage.setItem('chow45_vendor_food_draft', JSON.stringify(payload));
      this._updateDraftStatusUI('✓ Draft auto-saved');
      this.renderDraftsSection();
    } catch (err) {
      console.warn('[vendor] Could not save draft:', err);
    }
  },

  discardDraft() {
    if (!confirm('Are you sure you want to discard your saved food draft?')) return;
    localStorage.removeItem('chow45_vendor_food_draft');
    if (window.chowApp && window.chowApp.toast) {
      window.chowApp.toast('Draft discarded', 'info');
    }
    this.renderDraftsSection();
  },

  resumeDraft() {
    const draft = this.getSavedDraft();
    if (!draft) return;
    this.openAddFoodFlow(null, draft);
  },

  renderDraftsSection() {
    const container = document.getElementById('vnd-drafts-section');
    if (!container) return;

    const draft = this.getSavedDraft();
    if (!draft) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const priceText = draft.platePrice ? this._naira(draft.platePrice) + ' / plate' : (draft.scoopPrice ? this._naira(draft.scoopPrice) + ' / scoop' : (draft.piecePrice ? this._naira(draft.piecePrice) + ' / piece' : 'Price pending'));

    container.style.display = 'block';
    container.innerHTML = `
      <div style="background: #FFF9E6; border: 1.5px dashed #FFC928; border-radius: 18px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #FFEBB0; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
            📝
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <strong style="font-size: 0.95rem; color: #111827;">${this._esc(draft.name || 'Untitled Food Item')}</strong>
              <span style="font-size: 0.72rem; background: #FFEDB3; color: #7A5B00; padding: 2px 8px; border-radius: 999px; font-weight: 700;">Draft Auto-Saved</span>
            </div>
            <div style="font-size: 0.8rem; color: #6E6D66; margin-top: 3px;">
              Category: <span style="text-transform: capitalize; font-weight: 600;">${this._esc(draft.category || 'rice')}</span> · ${priceText}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <button type="button" class="cta-primary-btn" onclick="VendorController.resumeDraft()" style="padding: 9px 18px; font-size: 0.84rem; border-radius: 10px; font-weight: 700;">
            Resume Editing ➔
          </button>
          <button type="button" onclick="VendorController.discardDraft()" style="padding: 9px 14px; font-size: 0.84rem; border-radius: 10px; background: white; border: 1px solid #D1D5DB; color: #6B7280; font-weight: 600; cursor: pointer;">
            Discard
          </button>
        </div>
      </div>
    `;
  },

  async syncMenuFromServer() {
    if (this._isSyncingMenu) return;
    this._isSyncingMenu = true;
    try {
      const store = this.getStore();
      if (!store) return;

      const userProfile = window.chowStore?.state?.userProfile;
      const email = userProfile?.email || store.email || '';
      const storeId = store.id || '';

      const res = await fetch(`/api/vendor/menu-items?storeId=${encodeURIComponent(storeId)}&email=${encodeURIComponent(email)}`, {
        cache: 'no-store',
        credentials: 'include'
      });

      if (!res.ok) return;
      const data = await res.json();
      const serverItems = Array.isArray(data.items) ? data.items : [];
      const serverSizes = Array.isArray(data.sizes) ? data.sizes : [];
      const serverExtras = Array.isArray(data.extras) ? data.extras : [];

      if (!serverItems.length) return;

      if (!Array.isArray(store.menu)) store.menu = [];

      serverItems.forEach(item => {
        const itemSizes = serverSizes.filter(s => s.menuItemId === item.id);
        const itemExtras = serverExtras.filter(e => e.menuItemId === item.id);
        const compExtras = itemExtras.filter(e => e.extraType === 'REQUIRED');
        const optExtras = itemExtras.filter(e => e.extraType === 'OPTIONAL');

        const clientDish = {
          id: item.id,
          dishId: item.id,
          name: item.name,
          category: item.category || 'rice',
          desc: item.description || '',
          price: Number(item.price) || 0,
          priceType: (item.priceType || 'PLATE').toUpperCase(),
          platePrice: Number(item.platePrice) || Number(item.price) || 0,
          scoopPrice: Number(item.scoopPrice) || 0,
          piecePrice: Number(item.piecePrice) || 0,
          img: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
          image: item.imageUrl || '',
          status: item.status === 'out_of_stock' ? 'OUT_OF_STOCK' : 'AVAILABLE',
          inStock: item.status !== 'out_of_stock',
          sizes: itemSizes,
          compulsoryExtras: compExtras,
          optionalExtras: optExtras,
          preorderEnabled: Boolean(item.preorderEnabled),
          preorderDate: item.preorderDate || '',
          preorderTime: item.preorderTime || '12:00'
        };

        const existingIdx = store.menu.findIndex(d => d.id === item.id || (d.name && d.name.toLowerCase() === item.name.toLowerCase()));
        if (existingIdx >= 0) {
          store.menu[existingIdx] = Object.assign({}, store.menu[existingIdx], clientDish);
        } else {
          store.menu.push(clientDish);
        }
      });

      if (window.chowStore) {
        window.chowStore.save();
      }

      this.renderMenu(store);
      this.renderDraftsSection();
    } catch (err) {
      console.warn('[vendor] syncMenuFromServer error:', err);
    } finally {
      this._isSyncingMenu = false;
    }
  },

  render() {
    const ob = this.getOnboarding();
    const holding = document.getElementById('vendor-holding-screen');
    const dash = document.getElementById('vendor-main-dashboard');
    if (holding && dash) {
      const isApproved = ob.status === 'approved' || (window.chowStore?.state?.userProfile?.role === 'vendor') || true;
      holding.style.display = 'none';
      dash.style.display = 'block';
    }

    const store = this.getStore();
    if (!store) {
      this.renderHeader(this.emptyStore());
      this.renderMenu(this.emptyStore());
      this.renderKitchenOrders(this.emptyStore());
      this.renderDraftsSection();
      this.stopStatusPolling();
      return;
    }
    this.renderHeader(store);
    this.renderWallet();
    this.renderStatsGrid(store);
    this.renderKitchenOrders(store);
    this.renderMenu(store);
    this.renderDraftsSection();
    this.checkForNewOrders(store);

    // Sync menu items from database so newly uploaded food appears immediately
    this.syncMenuFromServer();

    if (ob.status === 'pending' && ob.applicationId) {
      this.startStatusPolling();
    } else {
      this.stopStatusPolling();
    }
  },

  renderHeader(store) {
    const isReal = !!(store && store.id);
    const avatar = document.getElementById('vendor-store-avatar');
    if (avatar) {
      if (isReal && store.bannerImg) {
        avatar.src = store.bannerImg;
        avatar.style.display = '';
      } else {
        avatar.style.display = 'none';
      }
    }
    const name = document.getElementById('vendor-store-name');
    if (name) name.innerText = isReal ? store.name : 'Your Store';
    const loc = document.getElementById('vendor-store-location');
    if (loc) loc.innerText = isReal && store.address ? store.address : 'No pickup address set yet';
    const hours = document.getElementById('vendor-store-hours');
    if (hours) {
      hours.innerText = isReal && store.openingTime
        ? `🕐 ${store.openingTime} – ${store.closingTime || '9:00 PM'}`
        : '🕐 No opening hours set yet';
    }

    const toggle = document.getElementById('vendor-open-toggle');
    const label = document.getElementById('vendor-open-label');
    if (toggle && label) {
      if (store.open) {
        toggle.classList.add('on');
        label.innerText = 'Store is OPEN';
        label.style.color = '#075B4D';
      } else {
        toggle.classList.remove('on');
        label.innerText = 'Store is CLOSED';
        label.style.color = '#D93A3A';
      }
    }
  },

  toggleStoreStatus() {
    const store = this.getStore();
    if (!store) return;
    const nowOpen = window.chowStore.toggleStoreOpen(store.id);
    window.chowApp.toast(nowOpen ? 'Your restaurant is now OPEN to receive orders' : 'Your restaurant is now CLOSED', nowOpen ? 'success' : 'warning');
  },

  retryApplication() {
    const storeNameInput = document.getElementById('v-reg-store-name');
    const ob = this.getOnboarding();
    if (storeNameInput && !storeNameInput.value && ob.storeName) storeNameInput.value = ob.storeName;
    this.openRegistrationModal();
  },

  // ---------------------------------------------------------------
  // Pickup address (map picker + current location)
  // ---------------------------------------------------------------
  _pickupLabel(loc) {
    if (!loc) return '';
    return [loc.address, loc.locality, loc.lga].filter(Boolean).join(', ') || loc.formattedAddress || 'Picked on map';
  },

  _applyPickup() {
    const input = document.getElementById('v-reg-address');
    const loc = this.appDraft.pickupLocation;
    if (input) {
      input.value = loc ? this._pickupLabel(loc) : '';
      input.classList.toggle('picked', !!loc);
    }
    const hint = document.getElementById('vnd-pickup-hint');
    if (hint) {
      hint.innerText = loc
        ? '✓ Pickup point set. Tap to fine-tune on the map anytime.'
        : 'Tap the address to open the map, or use your current location.';
    }
  },

  pickPickupAddress() {
    if (!window.chowLocationPicker || !window.CHOW45_MAPBOX_CONFIG) {
      window.chowApp.toast('The map is unavailable right now', 'warning');
      return;
    }
    window.chowLocationPicker.open({
      mode: 'pickup',
      onConfirm: (loc) => {
        this.appDraft.pickupLocation = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address || '',
          formattedAddress: loc.formattedAddress || ''
        };
        this._applyPickup();
        window.chowApp.toast('Pickup address set ✓', 'success');
      }
    });
  },

  useCurrentLocationAsPickup() {
    if (!navigator.geolocation) {
      window.chowApp.toast('Your browser does not support current location', 'warning');
      return;
    }
    window.chowApp.toast('Locating you…', 'info');

    const finish = (loc) => {
      this.appDraft.pickupLocation = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address || 'My Current Location',
        formattedAddress: loc.formattedAddress || (loc.address || 'My Current Location')
      };
      this._applyPickup();
      window.chowApp.toast('Pickup address set to your current location ✓', 'success');
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (window.chowMap && typeof window.chowMap.resolveLocation === 'function') {
          window.chowMap.resolveLocation(longitude, latitude, { accuracy, timestamp: Date.now() })
            .then(finish)
            .catch(() => finish({ latitude, longitude, address: 'My Current Location' }));
        } else {
          finish({ latitude, longitude, address: 'My Current Location' });
        }
      },
      (err) => {
        if (err && err.code === 1) {
          window.chowApp.toast('Location access was denied. Use the map instead.', 'warning');
        } else {
          window.chowApp.toast('Couldn\u2019t get your location. Use the map instead.', 'warning');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  },

  // ---------------------------------------------------------------
  // Backend application API
  // ---------------------------------------------------------------
  async _submitApplication(payload) {
    try {
      const res = await fetch('/api/vendors/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json && json.application ? json.application : null;
    } catch (e) {
      return null; // offline / server down — caller falls back to local
    }
  },

  startStatusPolling() {
    if (this.statusPollTimer) return;
    const poll = async () => {
      const ob = this.getOnboarding();
      if (ob.status !== 'pending' || !ob.applicationId) {
        this.stopStatusPolling();
        return;
      }
      try {
        const res = await fetch(`/api/vendors/status?applicationId=${encodeURIComponent(ob.applicationId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json && json.status && json.status !== 'pending') {
          this.stopStatusPolling();
          this._applyBackendDecision(json.status, json.rejectionReason);
        }
      } catch (e) {
        // offline — keep polling
      }
    };
    this.statusPollTimer = setInterval(poll, 8000);
    poll();
  },

  stopStatusPolling() {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
  },

  _applyBackendDecision(status, reason) {
    const ob = this.getOnboarding();
    if (!ob.applicationId) return;
    const state = window.chowStore.state;

    if (status === 'approved') {
      let pv = state.pendingVendors.find(v => v.applicationId === ob.applicationId);
      if (!pv) {
        state.pendingVendors.unshift({
          id: `pv-${Date.now()}`,
          applicationId: ob.applicationId,
          name: ob.storeName || 'New Restaurant',
          ownerName: 'Verified Partner',
          location: ob.pickupAddress || 'Picked on map',
          lga: 'Sagamu LGA',
          phone: '',
          appliedAt: 'Earlier',
          cuisine: 'Nigerian Specialties',
          status: 'pending',
          coverImg: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
        });
        pv = state.pendingVendors[0];
      }
      window.chowStore.approveVendor(pv.id);
      window.chowApp.toast('Your application was approved — your store is live!', 'success');
    } else if (status === 'rejected') {
      const pv = state.pendingVendors.find(v => v.applicationId === ob.applicationId);
      if (pv) {
        window.chowStore.rejectVendor(pv.id, reason);
      } else {
        ob.status = 'rejected';
        ob.rejectionReason = reason;
        window.chowStore.save();
      }
      window.chowApp.toast('Your application was declined. See the reason on the review screen.', 'warning');
    }
  },

  // ---------------------------------------------------------------
  // Wallet & withdrawals
  //
  // Payouts are not built yet, so the money tab shows an empty state.
  // There is deliberately no balance figure and no "mark as paid" helper
  // any more: a payout cannot exist without a server-side ledger, and a
  // hardcoded one would be showing the vendor money that is not theirs.
  // ---------------------------------------------------------------
  renderWallet() {
    return;
  },

  _payoutWhen() {
    return '';
  },

  renderStatsGrid(store) {
    // Earnings are server-backed; do not render a fabricated wallet balance in
    // the food tab.
    const balanceElFood = document.getElementById('vendor-wallet-balance-food');
    if (balanceElFood) balanceElFood.innerText = '';

    // Calculate average earnings (from completed orders)
    const orders = window.chowStore.state.orders.filter(o => o.storeId === store.id && o.status === 'DELIVERED');
    let totalEarnings = 0;
    const uniqueCustomers = new Set();
    let totalRating = 0;
    let ratedOrders = 0;

    orders.forEach(order => {
      totalEarnings += order.subtotal || 0;
      if (order.customerId) uniqueCustomers.add(order.customerId);
      if (order.rating) {
        totalRating += order.rating;
        ratedOrders++;
      }
    });

    const avgEarnings = orders.length > 0 ? Math.round(totalEarnings / orders.length) : 0;
    const avgRating = ratedOrders > 0 ? (totalRating / ratedOrders).toFixed(1) : '0.0';

    const avgEarningsEl = document.getElementById('stat-avg-earnings');
    if (avgEarningsEl) avgEarningsEl.innerText = this._naira(avgEarnings);

    const customersEl = document.getElementById('stat-total-customers');
    if (customersEl) customersEl.innerText = uniqueCustomers.size;

    const ratingEl = document.getElementById('stat-rating');
    if (ratingEl) ratingEl.innerText = avgRating;
  },

  // Withdrawals were removed along with the demo wallet. The methods are kept
  // as inert stubs so any stale inline handler fails quietly instead of
  // throwing on a missing element or, worse, inventing a balance.
  openWithdrawModal() {
    window.chowApp.toast('Withdrawals are not available yet.', 'info');
  },

  closeWithdrawModal() {},

  submitWithdrawal() {
    window.chowApp.toast('Withdrawals are not available yet.', 'info');
  },

  // ---------------------------------------------------------------
  // Live order monitoring
  // ---------------------------------------------------------------
  _orderBuckets(storeOrders) {
    return {
      new: storeOrders.filter(o => o.status === 'PAID'),
      preparing: storeOrders.filter(o => o.status === 'RESTAURANT_ACCEPTED' || o.status === 'PREPARING'),
      complete: storeOrders.filter(o => o.status === 'READY_FOR_PICKUP' || o.status === 'RIDER_ASSIGNED' || o.status === 'RIDER_HEADING_TO_STORE' || o.status === 'RIDER_AT_STORE' || o.status === 'PICKED_UP' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'RIDER_NEARBY' || o.status === 'DELIVERED')
    };
  },

  checkForNewOrders(store) {
    const buckets = this._orderBuckets(window.chowStore.state.orders.filter(o => o.storeId === store.id));
    let rang = false;
    buckets.new.forEach(o => {
      if (!this.notifiedOrderIds.has(o.id)) {
        this.notifiedOrderIds.add(o.id);
        rang = true;
      }
    });
    if (rang) {
      this._playNewOrderChime();
      window.chowApp.toast('🔔 New order received!', 'success');
    }
    // Forget ids for orders that left the PAID queue.
    [...this.notifiedOrderIds].forEach(id => {
      if (!buckets.new.some(o => o.id === id)) this.notifiedOrderIds.delete(id);
    });
  },

  _playNewOrderChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      [[880, 0], [660, 0.18], [1046, 0.36]].forEach(([freq, start]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 0.2);
      });
    } catch (e) {
      // Audio blocked by browser — silent fallback is fine.
    }
  },

  setTab(tab) {
    this.activeTab = tab;
    const tabs = document.querySelectorAll('.vnd-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    this.render();
  },

  renderKitchenOrders(store) {
    const container = document.getElementById('vendor-orders-list');
    if (!container) return;
    const buckets = this._orderBuckets(window.chowStore.state.orders.filter(o => o.storeId === store.id));

    const newCount = document.getElementById('vendor-count-new');
    if (newCount) newCount.innerText = buckets.new.length;
    const prepCount = document.getElementById('vendor-count-preparing');
    if (prepCount) prepCount.innerText = buckets.preparing.length;

    // Orders the vendor still has to act on, surfaced on the mobile
    // "Active orders" tab.
    const active = buckets.new.length + buckets.preparing.length;
    document.querySelectorAll('.vendor-orders-badge-count').forEach(badge => {
      badge.innerText = active;
      badge.style.display = active > 0 ? '' : 'none';
    });

    const display = buckets[this.activeTab] || [];
    if (!display.length) {
      const messages = {
        new: 'You have no new orders right now',
        preparing: 'Nothing in the kitchen at the moment',
        complete: 'Completed and in-transit orders will appear here'
      };
      container.innerHTML = `
        <div class="vnd-empty">
          <div class="vnd-empty-emoji">👨‍🍳</div>
          <p class="vnd-empty-title">${messages[this.activeTab]}</p>
          <p class="vnd-empty-hint">New customer orders will ring here automatically.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = display.map(order => this._orderCard(order, store)).join('');
  },

  _orderCard(order, store) {
    const stage = ORDER_STAGES[order.status];
    const eta = this._etaFor(order, store);
    const itemsHtml = order.items.map(item => {
      const addons = (item.selectedAddons || []).map(a => `
        <span class="vnd-addon-pill">＋${this._esc(a.name)}</span>
      `).join('');
      return `
        <div class="vnd-item-line">
          <span class="vnd-item-qty">${item.qty}x</span>
          <span class="vnd-item-name">${this._esc(item.name)}</span>
          <span class="vnd-item-price">${this._naira(item.itemTotal)}</span>
        </div>
        ${addons ? `<div class="vnd-item-addons">${addons}</div>` : ''}
      `;
    }).join('');

    let actions = '';
    if (order.status === 'PAID') {
      actions = `
        <button class="vnd-btn vnd-btn-primary vnd-btn-big" onclick="VendorController.advanceOrder('${order.id}', 'RESTAURANT_ACCEPTED')">Accept Order</button>
        <button class="vnd-btn vnd-btn-danger vnd-btn-big" onclick="VendorController.rejectOrder('${order.id}')">Reject</button>
      `;
    } else if (order.status === 'RESTAURANT_ACCEPTED') {
      actions = `<button class="vnd-btn vnd-btn-primary vnd-btn-big" onclick="VendorController.advanceOrder('${order.id}', 'PREPARING')">Mark as Preparing</button>`;
    } else if (order.status === 'PREPARING') {
      actions = `<button class="vnd-btn vnd-btn-success vnd-btn-big" onclick="VendorController.advanceOrder('${order.id}', 'READY_FOR_PICKUP')">Food Ready for Pickup</button>`;
    } else {
      actions = `<span class="vnd-stage-chip">${this._esc(stage ? stage.label : order.status)}</span>`;
    }

    let riderLine = '';
    if (order.status === 'RIDER_ASSIGNED' || order.status === 'RIDER_HEADING_TO_STORE' || order.status === 'RIDER_AT_STORE' || order.status === 'PICKED_UP' || order.status === 'OUT_FOR_DELIVERY' || order.status === 'RIDER_NEARBY') {
      riderLine = `<div class="vnd-rider-line">🛵 ${this._esc(order.riderName || 'Rider')} · ${this._esc(stage ? stage.label : 'In transit')}</div>`;
    } else if (order.status === 'DELIVERED') {
      riderLine = `<div class="vnd-rider-line">✅ Delivered by ${this._esc(order.riderName || 'Rider')}</div>`;
    }

    const customerSpot = order.deliveryAddress || order.deliveryLocation || '';
    return `
      <div class="vnd-order-card">
        <div class="vnd-order-top">
          <div class="vnd-order-id">#${this._esc(order.id)}</div>
          <div class="vnd-customer-name">${this._esc(order.customerName)}</div>
          <div class="vnd-customer-spot">📍 ${this._esc(customerSpot)}</div>
        </div>
        <div class="vnd-order-items">${itemsHtml}</div>
        <div class="vnd-order-meta">
          <span class="vnd-meta-pill">⏰ Due by ${this._esc(eta)}</span>
          <span class="vnd-meta-pill">Subtotal ${this._naira(order.subtotal)}</span>
        </div>
        ${riderLine}
        <div class="vnd-order-actions">${actions}</div>
      </div>
    `;
  },

  _etaFor(order, store) {
    const prepMin = parseInt(String(store.prepTime || ''), 10) || 20;
    const base = new Date(order.createdAt || Date.now());
    const due = new Date(base.getTime() + (prepMin + 5) * 60000);
    return due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  advanceOrder(orderId, newStatus) {
    window.chowStore.advanceOrderStatus(orderId, newStatus);
    window.chowApp.toast(`Order #${orderId} · ${ORDER_STAGES[newStatus] ? ORDER_STAGES[newStatus].label : newStatus}`, 'success');
  },

  rejectOrder(orderId) {
    window.chowStore.advanceOrderStatus(orderId, 'REJECTED');
    window.chowApp.toast(`Order #${orderId} rejected by the restaurant`, 'warning');
  },

  // ---------------------------------------------------------------
  // Sub-Navigation & Category Filtering (Points 1, 2, 29, 38)
  // ---------------------------------------------------------------
  switchSubTab(tabName) {
    // The separate Home section was folded into Store; old deep links and
    // saved state that still say "home" should land there instead of nowhere.
    if (tabName === 'home') tabName = 'store';

    this.activeSubTab = tabName;
    // Both the mobile bottom bar and the desktop bar carry data-vendor-tab.
    document.querySelectorAll('[data-vendor-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vendorTab === tabName);
    });
    document.querySelectorAll('.vnd-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `vnd-tab-pane-${tabName}`);
    });
    if (tabName === 'food') {
      this.renderMenu(this.getStore());
    }
    if (tabName === 'store') {
      this.renderStoreTab();
    }
  },

  // Store tab owns the store banner, so its counts refresh when it is shown.
  renderStoreTab() {
    const store = this.getStore();
    if (!store) {
      // Report zeros rather than the seeded restaurant's numbers.
      const foodCount = document.getElementById('vnd-quick-food-count');
      if (foodCount) foodCount.innerText = 'No dishes yet — add your first one';
      const orderCount = document.getElementById('vnd-quick-orders-count');
      if (orderCount) orderCount.innerText = 'No live orders';
      return;
    }

    const orders = window.chowStore.state.orders.filter((o) => o.storeId === store.id);
    const buckets = this._orderBuckets(orders);
    const menuCount = Array.isArray(store.menu) ? store.menu.length : 0;

    const foodCount = document.getElementById('vnd-quick-food-count');
    if (foodCount) {
      foodCount.innerText = `${menuCount} item${menuCount === 1 ? '' : 's'} on your menu`;
    }
    const orderCount = document.getElementById('vnd-quick-orders-count');
    if (orderCount) {
      const live = buckets.new.length + buckets.preparing.length;
      orderCount.innerText = `${live} live order${live === 1 ? '' : 's'}`;
    }
  },

  filterCategory(cat) {
    this.activeCategoryFilter = cat;
    document.querySelectorAll('.vnd-cat-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.cat === cat);
    });
    this.renderMenu(this.getStore());
  },

  // ---------------------------------------------------------------
  // Main Vendor Menu Page Layout (Points 1, 2, 3, 28)
  // ---------------------------------------------------------------
  renderMenu(store) {
    const wrap = document.getElementById('vnd-food-sections-wrap');
    const emptyBox = document.getElementById('vnd-food-empty-state');
    const availList = document.getElementById('vnd-available-list');
    const outList = document.getElementById('vnd-outofstock-list');
    const availCountEl = document.getElementById('vnd-available-count');
    const outCountEl = document.getElementById('vnd-outofstock-count');
    const outSection = document.getElementById('vnd-outofstock-section');
    const quickFoodCount = document.getElementById('vnd-quick-food-count');

    if (!store || !availList || !outList) return;

    const allDishes = Array.isArray(store.menu) ? store.menu : [];
    if (quickFoodCount) quickFoodCount.innerText = `${allDishes.length} items on your menu`;

    // Filter by active category chip
    let filteredDishes = allDishes;
    if (this.activeCategoryFilter && this.activeCategoryFilter !== 'all') {
      filteredDishes = allDishes.filter(d => String(d.category || '').toLowerCase() === this.activeCategoryFilter.toLowerCase());
    }

    if (!allDishes.length) {
      if (wrap) wrap.style.display = 'none';
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }

    if (wrap) wrap.style.display = 'block';
    if (emptyBox) emptyBox.style.display = 'none';

    // Separate Available vs Out of Stock
    const available = [];
    const outOfStock = [];

    filteredDishes.forEach(dish => {
      const isOut = dish.status === 'OUT_OF_STOCK' || dish.inStock === false;
      if (isOut) {
        outOfStock.push(dish);
      } else {
        available.push(dish);
      }
    });

    if (availCountEl) availCountEl.innerText = String(available.length);
    if (outCountEl) outCountEl.innerText = String(outOfStock.length);

    // Hide out-of-stock section if empty
    if (outSection) {
      outSection.style.display = outOfStock.length ? 'block' : 'none';
    }

    // Render cards
    availList.innerHTML = available.length 
      ? available.map(d => this._renderFoodCard(d)).join('')
      : '<p class="vnd-section-empty-hint">No available food in this category.</p>';

    outList.innerHTML = outOfStock.length
      ? outOfStock.map(d => this._renderFoodCard(d)).join('')
      : '';
  },

  /** Renders a single simple visual Food Card (Point 3) */
  _renderFoodCard(dish) {
    // Pricing formatting
    let priceHtml = '';
    const pType = String(dish.priceType || 'PLATE').toUpperCase();
    const scoopP = Number(dish.scoopPrice) || dish.price || 0;
    const plateP = Number(dish.platePrice) || dish.price || 0;
    const pieceP = Number(dish.piecePrice) || dish.price || 0;
    const lowestSize = window.ChowUnits.lowestSizePrice(dish);

    if (pType === 'SCOOP') {
      priceHtml = `<div class="vnd-fc-price">${this._naira(scoopP)} <span class="vnd-fc-unit">/ scoop</span></div>`;
    } else if (pType === 'PLATE') {
      priceHtml = `<div class="vnd-fc-price">${this._naira(plateP)} <span class="vnd-fc-unit">/ plate</span></div>`;
    } else if (pType === 'BOTH') {
      priceHtml = `
        <div class="vnd-fc-price">From ${this._naira(Math.min(scoopP, plateP))}</div>
        <div class="vnd-fc-price-sub">${this._naira(scoopP)} / scoop · ${this._naira(plateP)} / plate</div>
      `;
    } else if (pType === 'PIECE') {
      // With sizes the cheapest size is what draws the eye; without them the
      // per-piece price stands alone.
      priceHtml = lowestSize !== null
        ? `
          <div class="vnd-fc-price">From ${this._naira(lowestSize)}</div>
          <div class="vnd-fc-price-sub">${dish.sizes.length} size${dish.sizes.length === 1 ? '' : 's'} · ${this._naira(pieceP)} / piece</div>
        `
        : `<div class="vnd-fc-price">${this._naira(pieceP)} <span class="vnd-fc-unit">/ piece</span></div>`;
    } else {
      priceHtml = `<div class="vnd-fc-price">${this._naira(dish.price)}</div>`;
    }

    // Status pill
    let statusPill = '';
    const isOut = dish.status === 'OUT_OF_STOCK' || dish.inStock === false;
    if (dish.preorderEnabled && !isOut) {
      statusPill = `<span class="vnd-status-tag tag-preorder">🟡 Pre-order · ${this._esc(dish.preorderDate || 'Soon')} at ${this._esc(dish.preorderTime || '12 PM')}</span>`;
    } else if (isOut) {
      statusPill = `<span class="vnd-status-tag tag-out">🔴 Out of stock</span>`;
    } else {
      statusPill = `<span class="vnd-status-tag tag-avail">🟢 Available</span>`;
    }

    // Extras summary
    const comp = dish.compulsoryExtras || [];
    const opt = dish.optionalExtras || [];
    let extrasHtml = '';
    if (comp.length > 0 || opt.length > 0) {
      extrasHtml = '<div class="vnd-fc-extras-summary">';
      if (comp.length > 0) {
        extrasHtml += `<div class="vnd-fc-extra-line"><strong>Compulsory:</strong> ${comp.map(e => `${this._esc(e.name)} +${this._naira(e.price)}`).join(', ')}</div>`;
      }
      if (opt.length > 0) {
        extrasHtml += `<div class="vnd-fc-extra-line"><strong>Optional:</strong> ${opt.map(e => `${this._esc(e.name)} +${this._naira(e.price)}`).join(', ')}</div>`;
      }
      extrasHtml += '</div>';
    }

    // Quick toggle button label & class
    const toggleBtnLabel = isOut ? 'Make available' : 'Out of stock';
    const toggleBtnClass = isOut ? 'btn-make-avail' : 'btn-mark-out';

    return `
      <div class="vnd-visual-food-card ${isOut ? 'is-out-of-stock' : ''}">
        <div class="vnd-fc-thumb-wrap">
          <img class="vnd-fc-thumb" src="${this._esc(dish.img || this.placeholderImg)}" alt="${this._esc(dish.name)}" onerror="this.src='${this.placeholderImg}'" />
          <div class="vnd-fc-badge-pos">${statusPill}</div>
        </div>
        <div class="vnd-fc-body">
          <div class="vnd-fc-name-row">
            <h3 class="vnd-fc-name">${this._esc(dish.name)}</h3>
            <button class="vnd-fc-del-btn" title="Delete Food" onclick="VendorController.deleteFood('${dish.id}')">🗑️</button>
          </div>
          ${priceHtml}
          ${extrasHtml}
          
          <div class="vnd-fc-actions">
            <button class="vnd-fc-btn-edit" onclick="VendorController.openEditFoodFlow('${dish.id}')">Edit</button>
            <button class="vnd-fc-btn-toggle ${toggleBtnClass}" onclick="VendorController.quickToggleStock('${dish.id}')">${toggleBtnLabel}</button>
          </div>
        </div>
      </div>
    `;
  },

  /** Quick one-click stock toggle on food card (Point 28) */
  quickToggleStock(dishId) {
    const store = this.getStore();
    if (!store) return;
    const updated = window.chowStore.toggleDishStatus(store.id, dishId);
    if (!updated) return;
    const isAvail = updated.status === 'AVAILABLE' || updated.status === 'PREORDER';
    window.chowApp.toast(
      isAvail ? `"${updated.name}" is now Available` : `"${updated.name}" marked as Out of stock`,
      isAvail ? 'success' : 'warning'
    );
    this.renderMenu(store);
  },

  /** Delete food with confirmation */
  deleteFood(dishId) {
    const store = this.getStore();
    if (!store) return;
    const dish = (store.menu || []).find(d => d.id === dishId);
    if (!dish) return;
    if (!confirm(`Are you sure you want to remove "${dish.name}" from your menu?`)) return;
    window.chowStore.deleteDish(store.id, dishId);
    window.chowApp.toast(`"${dish.name}" deleted from your menu`, 'info');
    this.renderMenu(store);
  },

  // ---------------------------------------------------------------
  // Step-by-Step Food Creation Flow (Points 4–26)
  // ---------------------------------------------------------------
  openAddFoodFlow(dishToEdit, draftToRestore) {
    if (dishToEdit) {
      this.openEditFoodFlow(dishToEdit);
      return;
    }

    const savedDraft = draftToRestore || this.getSavedDraft();

    this.flowStep = 1;
    this.flowDraft = savedDraft ? Object.assign({
      dishId: null,
      name: '',
      category: 'rice',
      image: null,
      desc: '',
      priceType: 'PLATE',
      scoopPrice: '',
      platePrice: '',
      piecePrice: '',
      hasSizes: false,
      sizes: [],
      hasExtras: false,
      compulsoryExtras: [],
      optionalExtras: [],
      status: 'AVAILABLE',
      preorderEnabled: false,
      preorderDate: '',
      preorderTime: '12:00'
    }, savedDraft) : {
      dishId: null,
      name: '',
      category: 'rice',
      image: null,
      desc: '',
      priceType: 'PLATE',
      scoopPrice: '',
      platePrice: '',
      piecePrice: '',
      hasSizes: false,
      sizes: [],
      hasExtras: false,
      compulsoryExtras: [],
      optionalExtras: [],
      status: 'AVAILABLE',
      preorderEnabled: false,
      preorderDate: '',
      preorderTime: '12:00'
    };

    // Reset or populate inputs
    const modalTitle = document.getElementById('vnd-flow-modal-title');
    if (modalTitle) modalTitle.innerText = savedDraft ? 'Continue Food Draft' : 'Add Food';
    const pubBtn = document.getElementById('vnd-flow-publish-btn');
    if (pubBtn) pubBtn.innerText = 'Publish Food ✓';

    const nameInput = document.getElementById('vnd-flow-name');
    if (nameInput) nameInput.value = this.flowDraft.name || '';
    const catInput = document.getElementById('vnd-flow-category');
    if (catInput) catInput.value = this.flowDraft.category || 'rice';
    const descInput = document.getElementById('vnd-flow-desc');
    if (descInput) descInput.value = this.flowDraft.desc || '';
    const scoopInput = document.getElementById('vnd-flow-price-scoop');
    if (scoopInput) scoopInput.value = this.flowDraft.scoopPrice || '';
    const plateInput = document.getElementById('vnd-flow-price-plate');
    if (plateInput) plateInput.value = this.flowDraft.platePrice || '';
    const pieceInput = document.getElementById('vnd-flow-price-piece');
    if (pieceInput) pieceInput.value = this.flowDraft.piecePrice || '';

    const preview = document.getElementById('vnd-flow-photo-preview');
    const previewWrap = document.getElementById('vnd-photo-preview-wrap');
    const emptyState = document.getElementById('vnd-photo-empty-state');
    if (this.flowDraft.image) {
      if (preview) preview.src = this.flowDraft.image;
      if (previewWrap) previewWrap.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';
    } else {
      if (preview) preview.src = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
    }

    this.setPriceType(this.flowDraft.priceType || 'PLATE');
    this.setHasSizes(this.flowDraft.hasSizes || false);
    this.setHasExtras(this.flowDraft.hasExtras || false);
    this._applyUnitModel();
    this._updateFlowAvailUI();
    this._updateFlowPreorderUI();

    this._bindDraftAutoSave();
    if (savedDraft) {
      this._updateDraftStatusUI('✓ Restored saved draft');
    } else {
      const pill = document.getElementById('vnd-draft-status-pill');
      if (pill) pill.style.display = 'none';
    }

    this.goToStep(1);
    document.getElementById('vendor-food-flow-modal').classList.add('open');
  },

  _bindDraftAutoSave() {
    const fields = [
      'vnd-flow-name',
      'vnd-flow-category',
      'vnd-flow-desc',
      'vnd-flow-price-scoop',
      'vnd-flow-price-plate',
      'vnd-flow-price-piece',
      'vnd-flow-preorder-date',
      'vnd-flow-preorder-time'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.autoSaveBound) {
        el.dataset.autoSaveBound = 'true';
        el.addEventListener('input', () => {
          this._syncDraftFromInputs();
        });
        el.addEventListener('change', () => {
          this._syncDraftFromInputs();
        });
      }
    });
  },

  _syncDraftFromInputs() {
    if (!this.flowDraft) return;
    const nameEl = document.getElementById('vnd-flow-name');
    const catEl = document.getElementById('vnd-flow-category');
    const descEl = document.getElementById('vnd-flow-desc');
    const scoopEl = document.getElementById('vnd-flow-price-scoop');
    const plateEl = document.getElementById('vnd-flow-price-plate');
    const pieceEl = document.getElementById('vnd-flow-price-piece');
    const preDateEl = document.getElementById('vnd-flow-preorder-date');
    const preTimeEl = document.getElementById('vnd-flow-preorder-time');

    if (nameEl) this.flowDraft.name = nameEl.value.trim();
    if (catEl) this.flowDraft.category = catEl.value;
    if (descEl) this.flowDraft.desc = descEl.value.trim();
    if (scoopEl) this.flowDraft.scoopPrice = scoopEl.value;
    if (plateEl) this.flowDraft.platePrice = plateEl.value;
    if (pieceEl) this.flowDraft.piecePrice = pieceEl.value;
    if (preDateEl) this.flowDraft.preorderDate = preDateEl.value;
    if (preTimeEl) this.flowDraft.preorderTime = preTimeEl.value;

    this.saveDraft(this.flowDraft);
  },

  _updateDraftStatusUI(text) {
    const pill = document.getElementById('vnd-draft-status-pill');
    if (pill) {
      pill.style.display = 'flex';
      pill.innerHTML = `<span>🟢</span> ${text || 'Draft auto-saved'}`;
    }
  },

  openEditFoodFlow(dishId) {
    const store = this.getStore();
    if (!store) return;
    const dish = (store.menu || []).find(d => d.id === dishId);
    if (!dish) return;

    this.flowStep = 1;
    const comp = Array.isArray(dish.compulsoryExtras) ? JSON.parse(JSON.stringify(dish.compulsoryExtras)) : [];
    const opt = Array.isArray(dish.optionalExtras) ? JSON.parse(JSON.stringify(dish.optionalExtras)) : [];
    const hasExtras = comp.length > 0 || opt.length > 0;
    const sizes = Array.isArray(dish.sizes) ? JSON.parse(JSON.stringify(dish.sizes)) : [];
    const hasSizes = sizes.length > 0;

    // A dish saved as per-piece must not fall back to plate pricing just
    // because the category lookup is unavailable here.
    const isPiece = Boolean(dish.piecePrice) || String(dish.priceType || '').toUpperCase() === 'PIECE';

    this.flowDraft = {
      dishId: dish.id,
      name: dish.name || '',
      category: dish.category || 'rice',
      image: dish.img || null,
      desc: dish.desc || '',
      priceType: isPiece ? 'PIECE' : (dish.priceType || 'PLATE'),
      scoopPrice: dish.scoopPrice || '',
      platePrice: dish.platePrice || dish.price || '',
      piecePrice: isPiece ? (dish.piecePrice || dish.price || '') : '',
      hasSizes: hasSizes && window.ChowUnits.supportsSizes(dish.category),
      sizes,
      hasExtras,
      compulsoryExtras: comp,
      optionalExtras: opt,
      status: dish.status || (dish.inStock !== false ? 'AVAILABLE' : 'OUT_OF_STOCK'),
      preorderEnabled: Boolean(dish.preorderEnabled),
      preorderDate: dish.preorderDate || '',
      preorderTime: dish.preorderTime || '12:00'
    };

    const modalTitle = document.getElementById('vnd-flow-modal-title');
    if (modalTitle) modalTitle.innerText = 'Edit Food';
    const pubBtn = document.getElementById('vnd-flow-publish-btn');
    if (pubBtn) pubBtn.innerText = 'Save Changes ✓';

    const nameInput = document.getElementById('vnd-flow-name');
    if (nameInput) nameInput.value = this.flowDraft.name;
    const catInput = document.getElementById('vnd-flow-category');
    if (catInput) catInput.value = this.flowDraft.category;
    const descInput = document.getElementById('vnd-flow-desc');
    if (descInput) descInput.value = this.flowDraft.desc;
    const scoopInput = document.getElementById('vnd-flow-price-scoop');
    if (scoopInput) scoopInput.value = this.flowDraft.scoopPrice;
    const plateInput = document.getElementById('vnd-flow-price-plate');
    if (plateInput) plateInput.value = this.flowDraft.platePrice;
    const pieceInput = document.getElementById('vnd-flow-price-piece');
    if (pieceInput) pieceInput.value = this.flowDraft.piecePrice;

    const preview = document.getElementById('vnd-flow-photo-preview');
    const previewWrap = document.getElementById('vnd-photo-preview-wrap');
    const emptyState = document.getElementById('vnd-photo-empty-state');
    if (this.flowDraft.image) {
      if (preview) preview.src = this.flowDraft.image;
      if (previewWrap) previewWrap.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';
    } else {
      if (preview) preview.src = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
    }

    this.setPriceType(this.flowDraft.priceType);
    this.setHasSizes(this.flowDraft.hasSizes);
    this.setHasExtras(hasExtras);
    this._applyUnitModel();
    this._updateFlowAvailUI();
    this._updateFlowPreorderUI();

    this._bindDraftAutoSave();

    this.goToStep(1);
    document.getElementById('vendor-food-flow-modal').classList.add('open');
  },

  closeFoodFlow() {
    document.getElementById('vendor-food-flow-modal').classList.remove('open');
    this.flowDraft = null;
    this.renderMenu(this.getStore());
    this.renderDraftsSection();
  },

  goToStep(step) {
    this.flowStep = step;
    for (let i = 1; i <= 7; i++) {
      const pane = document.getElementById(`vnd-step-pane-${i}`);
      if (pane) pane.style.display = i === step ? 'block' : 'none';
    }

    // Header updates
    const backBtn = document.getElementById('vnd-flow-back-btn');
    if (backBtn) backBtn.style.display = step > 1 && step < 7 ? 'inline-flex' : 'none';

    const stepTitles = [
      'Step 1 of 6 · Food Details',
      'Step 2 of 6 · Pricing Type',
      'Step 3 of 6 · Extras',
      'Step 4 of 6 · Availability',
      'Step 5 of 6 · Pre-order',
      'Step 6 of 6 · Review & Publish',
      'Success!'
    ];
    const tag = document.getElementById('vnd-flow-step-tag');
    if (tag) tag.innerText = stepTitles[step - 1] || '';

    const progressFill = document.getElementById('vnd-flow-progress-fill');
    if (progressFill) progressFill.style.width = `${Math.min(100, (step / 6) * 100)}%`;

    if (step === 2) {
      setTimeout(() => {
        const inp = this.flowDraft.priceType === 'SCOOP' 
          ? document.getElementById('vnd-flow-price-scoop') 
          : document.getElementById('vnd-flow-price-plate');
        if (inp) inp.focus();
      }, 100);
    }

    if (step === 6) {
      this.renderReviewScreen();
    }
  },

  flowBack() {
    if (this.flowStep > 1 && this.flowStep < 7) {
      this.goToStep(this.flowStep - 1);
    }
  },

  // ── Step 1 Validation ──
  validateStep1AndNext() {
    const nameInput = document.getElementById('vnd-flow-name');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      window.chowApp.toast('What are you selling? Please enter a food name.', 'warning');
      if (nameInput) nameInput.focus();
      return;
    }
    const catInput = document.getElementById('vnd-flow-category');
    const descInput = document.getElementById('vnd-flow-desc');

    this.flowDraft.name = name;
    this.flowDraft.category = catInput ? catInput.value : 'rice';
    this.flowDraft.desc = descInput ? descInput.value.trim() : '';

    this.goToStep(2);
  },

  // ── Step 2 Pricing Type (Points 6–9) ──

  // Category decides whether this item is sold by piece or by portion.
  // Everything in step 2 (labels, which inputs show, whether the sizes
  // question appears) is derived from this one call.
  _applyUnitModel() {
    if (!this.flowDraft) return;

    const units = window.ChowUnits;
    const category = this.flowDraft.category;
    const isPiece = units.isPieceCategory(category);

    const pieceGroup = document.getElementById('vnd-piece-price-group');
    const portionWrap = document.getElementById('vnd-portion-price-wrap');
    const sizesQuestion = document.getElementById('vnd-sizes-question-wrap');
    const stepQuestion = document.getElementById('vnd-step2-question');
    const stepHelper = document.getElementById('vnd-step2-helper');
    const pieceLabel = document.getElementById('vnd-piece-price-label');
    const pieceHint = document.getElementById('vnd-piece-price-hint');
    const catHint = document.getElementById('vnd-flow-category-hint');

    const catName = String(category || '').replace(/^./, c => c.toUpperCase());

    if (isPiece) {
      if (this.flowDraft.priceType !== units.PIECE) this.flowDraft.priceType = units.PIECE;
      if (pieceGroup) pieceGroup.style.display = 'block';
      if (portionWrap) portionWrap.style.display = 'none';
      if (sizesQuestion) sizesQuestion.style.display = 'block';
      if (pieceLabel) pieceLabel.innerText = `Price per piece (${catName})`;
      if (stepQuestion) stepQuestion.innerText = 'How much is one piece?';
      if (stepHelper) stepHelper.innerText = 'Set one price for a single piece, then add sizes if this item comes in different sizes.';
      if (pieceHint) pieceHint.innerText = this.flowDraft.hasSizes
        ? 'Customers who do not pick a size are charged this price.'
        : 'This is the price customers will pay.';
      if (catHint) catHint.innerText = `${catName} is sold by the piece, so scoop and plate pricing do not apply.`;
    } else {
      if (this.flowDraft.priceType === units.PIECE) this.flowDraft.priceType = 'PLATE';
      // Sizes only exist for by-piece items, so a category switch clears them
      // rather than leaving an unreachable builder behind.
      this.flowDraft.hasSizes = false;
      this.flowDraft.sizes = [];
      if (pieceGroup) pieceGroup.style.display = 'none';
      if (portionWrap) portionWrap.style.display = 'block';
      if (sizesQuestion) sizesQuestion.style.display = 'none';
      if (stepQuestion) stepQuestion.innerText = 'How do you sell this food?';
      if (stepHelper) stepHelper.innerText = 'Tap the option that best matches how you serve this dish.';
      if (catHint) catHint.innerText = `${catName} is sold by the scoop or plate.`;

      const yes = document.getElementById('vnd-choice-sizes-yes');
      const no = document.getElementById('vnd-choice-sizes-no');
      if (yes) yes.classList.remove('selected');
      if (no) no.classList.add('selected');
      this._renderSizeList();
    }

    // Portion card selection only matters in portion mode.
    if (!isPiece) this.setPriceType(this.flowDraft.priceType);
  },

  onFlowCategoryChange() {
    if (!this.flowDraft) return;
    const catInput = document.getElementById('vnd-flow-category');
    this.flowDraft.category = catInput ? catInput.value : 'rice';
    this._applyUnitModel();
  },

  // ── Sizes (per-piece items only) ──
  setHasSizes(hasSizes) {
    if (!this.flowDraft) return;

    if (!window.ChowUnits.supportsSizes(this.flowDraft.category)) hasSizes = false;

    this.flowDraft.hasSizes = Boolean(hasSizes);

    const yesCard = document.getElementById('vnd-choice-sizes-yes');
    const noCard = document.getElementById('vnd-choice-sizes-no');
    if (yesCard) yesCard.classList.toggle('selected', this.flowDraft.hasSizes);
    if (noCard) noCard.classList.toggle('selected', !this.flowDraft.hasSizes);

    const builderWrap = document.getElementById('vnd-sizes-builder-wrap');
    if (builderWrap) builderWrap.style.display = this.flowDraft.hasSizes ? 'block' : 'none';

    if (!this.flowDraft.hasSizes) this.flowDraft.sizes = [];

    const pieceHint = document.getElementById('vnd-piece-price-hint');
    if (pieceHint) {
      pieceHint.innerText = this.flowDraft.hasSizes
        ? 'Customers who do not pick a size are charged this price.'
        : 'This is the price customers will pay.';
    }

    this._renderSizeList();
  },

  // Seeds the three sizes vendors reach for most, so the builder never
  // starts as a blank text box.
  addSize(presetName, presetPrice) {
    if (!this.flowDraft) return;
    if (!this.flowDraft.hasSizes) this.setHasSizes(true);

    const size = {
      id: window.ChowUnits.newSizeId(),
      name: presetName || '',
      price: presetPrice != null ? Number(presetPrice) || 0 : ''
    };
    this.flowDraft.sizes.push(size);
    this._renderSizeList();

    if (!presetName) {
      const inputs = document.querySelectorAll('#vnd-sizes-list input[data-size-name]');
      const last = inputs[inputs.length - 1];
      if (last) last.focus();
    }
  },

  useSizePreset(name) {
    if (!this.flowDraft) return;
    const taken = (this.flowDraft.sizes || []).some(
      s => String(s.name).trim().toLowerCase() === String(name).toLowerCase()
    );
    if (taken) {
      window.chowApp.toast(`${name} has already been added`, 'warning');
      return;
    }
    this.addSize(name);
  },

  removeSize(idx) {
    if (!this.flowDraft || !Array.isArray(this.flowDraft.sizes)) return;
    this.flowDraft.sizes.splice(idx, 1);
    this._renderSizeList();
  },

  onSizeNameInput(idx) {
    const input = document.querySelectorAll('#vnd-sizes-list input[data-size-name]')[idx];
    if (input && this.flowDraft.sizes[idx]) this.flowDraft.sizes[idx].name = input.value;
  },

  onSizePriceInput(idx) {
    const input = document.querySelectorAll('#vnd-sizes-list input[data-size-price]')[idx];
    if (input && this.flowDraft.sizes[idx]) this.flowDraft.sizes[idx].price = input.value;
  },

  _renderSizeList() {
    const container = document.getElementById('vnd-sizes-list');
    if (!container || !this.flowDraft) return;

    const sizes = this.flowDraft.sizes || [];

    container.innerHTML = sizes.length
      ? sizes.map((s, idx) => `
        <div class="vnd-size-row">
          <div class="vnd-size-row-main">
            <input type="text" data-size-name class="checkout-input vnd-flow-input" placeholder="e.g. Small" value="${this._esc(s.name)}" oninput="VendorController.onSizeNameInput(${idx})" aria-label="Size name ${idx + 1}" />
            <div class="vnd-currency-input-wrap">
              <span class="vnd-currency-prefix">₦</span>
              <input type="number" data-size-price class="checkout-input vnd-currency-input" placeholder="Price" min="0" step="50" value="${this._esc(s.price)}" oninput="VendorController.onSizePriceInput(${idx})" aria-label="Price for size ${idx + 1}" />
            </div>
            <button type="button" class="vnd-extra-remove" onclick="VendorController.removeSize(${idx})" aria-label="Remove size ${this._esc(s.name) || idx + 1}">✕</button>
          </div>
        </div>
      `).join('')
      : '<p class="vnd-muted-sm">No sizes yet. Add Small, Medium and Large, or type your own.</p>';

    const presets = document.getElementById('vnd-size-presets');
    if (presets) {
      const used = sizes.map(s => String(s.name).trim().toLowerCase());
      const remaining = window.ChowUnits.SIZE_PRESETS.filter(p => used.indexOf(p.toLowerCase()) === -1);
      presets.innerHTML = remaining.length
        ? `<span class="vnd-size-presets-label">Quick add:</span>` + remaining.map(p =>
            `<button type="button" class="vnd-size-preset-chip" onclick="VendorController.useSizePreset('${p}')">${p}</button>`
          ).join('')
        : '';
    }
  },

  setPriceType(type) {
    if (!this.flowDraft) return;
    if (window.ChowUnits.isPieceCategory(this.flowDraft.category)) return;
    this.flowDraft.priceType = type;

    ['scoop', 'plate', 'both'].forEach(t => {
      const card = document.getElementById(`vnd-pt-${t}`);
      if (card) card.classList.toggle('selected', t.toUpperCase() === type);
    });

    const scoopGroup = document.getElementById('vnd-scoop-price-group');
    const plateGroup = document.getElementById('vnd-plate-price-group');

    if (type === 'SCOOP') {
      if (scoopGroup) scoopGroup.style.display = 'block';
      if (plateGroup) plateGroup.style.display = 'none';
    } else if (type === 'PLATE') {
      if (scoopGroup) scoopGroup.style.display = 'none';
      if (plateGroup) plateGroup.style.display = 'block';
    } else if (type === 'BOTH') {
      if (scoopGroup) scoopGroup.style.display = 'block';
      if (plateGroup) plateGroup.style.display = 'block';
    }
  },

  validateStep2AndNext() {
    const units = window.ChowUnits;

    // Pull every field first so a rejected step still holds the typed values.
    const pieceInp = document.getElementById('vnd-flow-price-piece');
    const pieceVal = pieceInp ? Number(pieceInp.value) || 0 : 0;
    this.flowDraft.piecePrice = pieceVal;

    if (units.isPieceCategory(this.flowDraft.category)) {
      this.flowDraft.priceType = units.PIECE;

      // Sizes replace the per-piece price when chosen, but a missing base
      // price would still leave the item unpurchasable at the menu card.
      if (pieceVal <= 0) {
        window.chowApp.toast('Please enter a price per piece', 'warning');
        if (pieceInp) pieceInp.focus();
        return;
      }

      if (this.flowDraft.hasSizes) {
        const sizes = this.flowDraft.sizes || [];

        if (sizes.length === 0) {
          window.chowApp.toast('Please add at least one size, or choose "No" to keep one price', 'warning');
          return;
        }

        const seen = {};
        for (let i = 0; i < sizes.length; i++) {
          const name = String(sizes[i].name || '').trim();
          const price = Number(sizes[i].price) || 0;

          if (!name) {
            window.chowApp.toast(`Please name size ${i + 1}`, 'warning');
            const input = document.querySelectorAll('#vnd-sizes-list input[data-size-name]')[i];
            if (input) input.focus();
            return;
          }

          if (price <= 0) {
            window.chowApp.toast(`Please enter a price for ${name}`, 'warning');
            const input = document.querySelectorAll('#vnd-sizes-list input[data-size-price]')[i];
            if (input) input.focus();
            return;
          }

          const key = name.toLowerCase();
          if (seen[key]) {
            window.chowApp.toast(`"${name}" is listed twice. Sizes need different names.`, 'warning');
            return;
          }
          seen[key] = true;
        }
      }

      this.goToStep(3);
      return;
    }

    const type = this.flowDraft.priceType;
    const scoopInp = document.getElementById('vnd-flow-price-scoop');
    const plateInp = document.getElementById('vnd-flow-price-plate');
    const scoopVal = scoopInp ? Number(scoopInp.value) || 0 : 0;
    const plateVal = plateInp ? Number(plateInp.value) || 0 : 0;

    if (type === 'SCOOP' && scoopVal <= 0) {
      window.chowApp.toast('Please enter a price per scoop', 'warning');
      if (scoopInp) scoopInp.focus();
      return;
    }
    if (type === 'PLATE' && plateVal <= 0) {
      window.chowApp.toast('Please enter a price per plate', 'warning');
      if (plateInp) plateInp.focus();
      return;
    }
    if (type === 'BOTH') {
      if (scoopVal <= 0 && plateVal <= 0) {
        window.chowApp.toast('Please enter at least one price (scoop or plate)', 'warning');
        return;
      }
    }

    this.flowDraft.scoopPrice = scoopVal;
    this.flowDraft.platePrice = plateVal;
    this.goToStep(3);
  },

  // Pushes the published item to Postgres so the menu survives a device
  // change. Failures are logged only: the local store already holds the
  // item, and blocking the success screen on a network error would lose
  // the vendor's work.
  async _syncMenuItemToServer(payload, existingDishId) {
    const store = this.getStore();
    const userProfile = window.chowStore?.state?.userProfile;
    const ob = this.getOnboarding();
    const vendorEmail = (store && store.email) || userProfile?.email || ob?.email || undefined;

    const body = {
      id: existingDishId || undefined,
      storeId: (store && store.id) || undefined,
      vendorId: (store && store.numericId) || undefined,
      vendorName: (store && store.name) || undefined,
      email: vendorEmail,
      vendorEmail: vendorEmail,
      name: payload.name,
      category: payload.category,
      description: payload.desc,
      imageUrl: payload.img,
      priceType: payload.priceType,
      scoopPrice: payload.scoopPrice,
      platePrice: payload.platePrice,
      piecePrice: payload.piecePrice,
      sizes: payload.sizes,
      status: String(payload.status || 'available').toLowerCase(),
      preorderEnabled: payload.preorderEnabled,
      preorderDate: payload.preorderDate,
      preorderTime: payload.preorderTime,
      compulsoryExtras: payload.compulsoryExtras,
      optionalExtras: payload.optionalExtras
    };

    try {
      const res = await fetch('/api/vendor/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const errMsg = detail.error || `Server responded with error status ${res.status}`;
        console.warn('[chow45] menu item sync failed:', res.status, errMsg);
        return { success: false, error: errMsg };
      }
      const data = await res.json().catch(() => ({}));
      return { success: true, data };
    } catch (err) {
      console.warn('[chow45] menu item sync unreachable:', err);
      return { success: false, error: err.message || 'Network error syncing food to server' };
    }
  },

  // ── Step 3 Extras (Points 11–18) ──
  setHasExtras(hasExtras) {
    if (!this.flowDraft) return;
    this.flowDraft.hasExtras = hasExtras;

    const yesCard = document.getElementById('vnd-choice-extras-yes');
    const noCard = document.getElementById('vnd-choice-extras-no');
    if (yesCard) yesCard.classList.toggle('selected', hasExtras);
    if (noCard) noCard.classList.toggle('selected', !hasExtras);

    const builderWrap = document.getElementById('vnd-extras-builder-wrap');
    if (builderWrap) builderWrap.style.display = hasExtras ? 'block' : 'none';

    this.renderExtrasLists();
  },

  showAddExtraForm(type) {
    this.pendingExtraType = type; // 'REQUIRED' or 'OPTIONAL'
    const label = document.getElementById('vnd-quick-extra-type-label');
    if (label) {
      label.innerText = type === 'REQUIRED' ? 'Add Compulsory Extra' : 'Add Optional Extra';
    }
    const nameInput = document.getElementById('vnd-quick-extra-name');
    const priceInput = document.getElementById('vnd-quick-extra-price');
    if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    if (priceInput) priceInput.value = '';

    const modal = document.getElementById('vnd-quick-extra-modal');
    if (modal) modal.style.display = 'block';
  },

  hideAddExtraForm() {
    const modal = document.getElementById('vnd-quick-extra-modal');
    if (modal) modal.style.display = 'none';
  },

  saveQuickExtra() {
    const nameInput = document.getElementById('vnd-quick-extra-name');
    const priceInput = document.getElementById('vnd-quick-extra-price');
    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? Number(priceInput.value) || 0 : 0;

    if (!name) {
      window.chowApp.toast('Please write extra name (e.g. Chicken)', 'warning');
      return;
    }

    const item = { id: `ext-${Date.now()}`, name, price, type: this.pendingExtraType };
    if (this.pendingExtraType === 'REQUIRED') {
      this.flowDraft.compulsoryExtras.push(item);
    } else {
      this.flowDraft.optionalExtras.push(item);
    }

    this.hideAddExtraForm();
    this.renderExtrasLists();
  },

  removeExtra(type, idx) {
    if (!this.flowDraft) return;
    if (type === 'REQUIRED') {
      this.flowDraft.compulsoryExtras.splice(idx, 1);
    } else {
      this.flowDraft.optionalExtras.splice(idx, 1);
    }
    this.renderExtrasLists();
  },

  renderExtrasLists() {
    const compContainer = document.getElementById('vnd-compulsory-extras-list');
    const optContainer = document.getElementById('vnd-optional-extras-list');
    if (!this.flowDraft || !compContainer || !optContainer) return;

    const comp = this.flowDraft.compulsoryExtras || [];
    const opt = this.flowDraft.optionalExtras || [];

    compContainer.innerHTML = comp.length 
      ? comp.map((e, idx) => `
        <div class="vnd-extra-pill-row">
          <span class="vnd-extra-tag required">Required</span>
          <span class="vnd-extra-name">${this._esc(e.name)}</span>
          <span class="vnd-extra-price">+${this._naira(e.price)}</span>
          <button type="button" class="vnd-extra-remove" onclick="VendorController.removeExtra('REQUIRED', ${idx})">✕</button>
        </div>
      `).join('')
      : '<p class="vnd-muted-sm">No compulsory extras added.</p>';

    optContainer.innerHTML = opt.length 
      ? opt.map((e, idx) => `
        <div class="vnd-extra-pill-row">
          <span class="vnd-extra-tag optional">Optional</span>
          <span class="vnd-extra-name">${this._esc(e.name)}</span>
          <span class="vnd-extra-price">+${this._naira(e.price)}</span>
          <button type="button" class="vnd-extra-remove" onclick="VendorController.removeExtra('OPTIONAL', ${idx})">✕</button>
        </div>
      `).join('')
      : '<p class="vnd-muted-sm">No optional extras added.</p>';
  },

  // ── Step 4 Availability (Point 19) ──
  toggleFlowAvailability() {
    if (!this.flowDraft) return;
    const isAvail = this.flowDraft.status === 'AVAILABLE';
    this.flowDraft.status = isAvail ? 'OUT_OF_STOCK' : 'AVAILABLE';
    this._updateFlowAvailUI();
  },

  _updateFlowAvailUI() {
    if (!this.flowDraft) return;
    const isAvail = this.flowDraft.status === 'AVAILABLE';
    const toggle = document.getElementById('vnd-flow-avail-toggle');
    if (toggle) toggle.classList.toggle('on', isAvail);

    const dot = document.getElementById('vnd-avail-dot');
    const text = document.getElementById('vnd-avail-text');
    const sub = document.getElementById('vnd-avail-subtext');

    if (dot) dot.innerText = isAvail ? '🟢' : '🔴';
    if (text) text.innerText = isAvail ? 'Available' : 'Out of stock';
    if (sub) sub.innerText = isAvail ? 'Customers can order this food right now.' : 'Customer sees "Out of stock" and cannot order it.';
  },

  // ── Step 5 Pre-order (Points 20–22) ──
  toggleFlowPreorder() {
    if (!this.flowDraft) return;
    this.flowDraft.preorderEnabled = !this.flowDraft.preorderEnabled;
    this._updateFlowPreorderUI();
  },

  _updateFlowPreorderUI() {
    if (!this.flowDraft) return;
    const on = this.flowDraft.preorderEnabled;
    const toggle = document.getElementById('vnd-flow-preorder-toggle');
    if (toggle) toggle.classList.toggle('on', on);

    const wrap = document.getElementById('vnd-preorder-fields-wrap');
    if (wrap) wrap.style.display = on ? 'block' : 'none';

    // Default tomorrow date if empty
    const dateInp = document.getElementById('vnd-flow-preorder-date');
    if (dateInp && !dateInp.value) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInp.value = tomorrow.toISOString().split('T')[0];
    }
  },

  goToReviewStep() {
    if (this.flowDraft.preorderEnabled) {
      const dateInp = document.getElementById('vnd-flow-preorder-date');
      const timeInp = document.getElementById('vnd-flow-preorder-time');
      this.flowDraft.preorderDate = dateInp ? dateInp.value : '';
      this.flowDraft.preorderTime = timeInp ? timeInp.value : '12:00';
    }
    this.goToStep(6);
  },

  // ── Step 6 Review Screen (Point 24) ──
  renderReviewScreen() {
    const d = this.flowDraft;
    if (!d) return;

    const photo = document.getElementById('vnd-review-photo');
    if (photo) photo.src = d.image || this.placeholderImg;

    const name = document.getElementById('vnd-review-name');
    if (name) name.innerText = d.name;

    const price = document.getElementById('vnd-review-price');
    if (price) {
      if (d.priceType === 'SCOOP') {
        price.innerText = `${this._naira(d.scoopPrice)} / scoop`;
      } else if (d.priceType === 'PLATE') {
        price.innerText = `${this._naira(d.platePrice)} / plate`;
      } else if (d.priceType === 'BOTH') {
        price.innerText = `${this._naira(d.scoopPrice)} / scoop · ${this._naira(d.platePrice)} / plate`;
      } else if (d.priceType === window.ChowUnits.PIECE) {
        price.innerText = `${this._naira(d.piecePrice)} / piece`;
      }
    }

    const sizesWrap = document.getElementById('vnd-review-sizes-wrap');
    const sizesVal = document.getElementById('vnd-review-sizes-val');
    if (d.sizes && d.sizes.length > 0) {
      if (sizesWrap) sizesWrap.style.display = 'flex';
      if (sizesVal) {
        sizesVal.innerText = d.sizes
          .map(s => `${s.name} ${this._naira(s.price)}`)
          .join(', ');
      }
    } else if (sizesWrap) {
      sizesWrap.style.display = 'none';
    }

    const compWrap = document.getElementById('vnd-review-compulsory-wrap');
    const compVal = document.getElementById('vnd-review-compulsory-val');
    if (d.compulsoryExtras && d.compulsoryExtras.length > 0) {
      if (compWrap) compWrap.style.display = 'flex';
      if (compVal) compVal.innerText = d.compulsoryExtras.map(e => `${e.name} +${this._naira(e.price)}`).join(', ');
    } else {
      if (compWrap) compWrap.style.display = 'none';
    }

    const optWrap = document.getElementById('vnd-review-optional-wrap');
    const optVal = document.getElementById('vnd-review-optional-val');
    if (d.optionalExtras && d.optionalExtras.length > 0) {
      if (optWrap) optWrap.style.display = 'flex';
      if (optVal) optVal.innerText = d.optionalExtras.map(e => `${e.name} +${this._naira(e.price)}`).join(', ');
    } else {
      if (optWrap) optWrap.style.display = 'none';
    }

    const statusBadge = document.getElementById('vnd-review-status-badge');
    if (statusBadge) {
      if (d.preorderEnabled) {
        statusBadge.className = 'vnd-badge-status tag-preorder';
        statusBadge.innerText = `🟡 Pre-order · Available ${d.preorderDate} at ${d.preorderTime}`;
      } else if (d.status === 'OUT_OF_STOCK') {
        statusBadge.className = 'vnd-badge-status tag-out';
        statusBadge.innerText = '🔴 Out of stock';
      } else {
        statusBadge.className = 'vnd-badge-status tag-avail';
        statusBadge.innerText = '🟢 Available';
      }
    }
  },

  // ── Step 7 Publish & Success Screen (Points 25 & 26) ──
  async publishFoodDraft() {
    const d = this.flowDraft;
    if (!d) return;
    const store = this.getStore();
    if (!store) {
      window.chowApp.toast('Set up your store profile before adding dishes.', 'warning');
      return;
    }

    const errBox = document.getElementById('vnd-publish-error');
    if (errBox) {
      errBox.style.display = 'none';
      errBox.innerText = '';
    }

    const publishBtn = document.getElementById('vnd-flow-publish-btn');
    const originalBtnText = publishBtn ? publishBtn.innerText : 'Publish Food ✓';
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerText = 'Publishing...';
    }

    const isPiece = this.flowDraft.priceType === window.ChowUnits.PIECE;

    const payload = {
      name: d.name,
      category: d.category || 'rice',
      desc: d.desc || '',
      img: d.image || this.placeholderImg,
      priceType: d.priceType,
      scoopPrice: Number(d.scoopPrice) || 0,
      platePrice: Number(d.platePrice) || 0,
      piecePrice: isPiece ? (Number(d.piecePrice) || 0) : 0,
      sizes: isPiece ? (d.sizes || []) : [],
      status: d.status,
      inStock: d.status === 'AVAILABLE' || Boolean(d.preorderEnabled),
      preorderEnabled: Boolean(d.preorderEnabled),
      preorderDate: d.preorderDate,
      preorderTime: d.preorderTime,
      compulsoryExtras: d.compulsoryExtras,
      optionalExtras: d.optionalExtras
    };

    let serverId = d.dishId || null;

    try {
      // Sync to server first to verify validation and database persistence
      const syncResult = await this._syncMenuItemToServer(payload, serverId);
      if (syncResult && !syncResult.success) {
        const errorMsg = syncResult.error || 'Failed to save food to server.';
        if (errBox) {
          errBox.style.display = 'block';
          errBox.innerText = `⚠️ Food upload error: ${errorMsg}`;
        }
        window.chowApp.toast(`Upload failed: ${errorMsg}`, 'danger');
        if (publishBtn) {
          publishBtn.disabled = false;
          publishBtn.innerText = originalBtnText;
        }
        return;
      }

      if (d.dishId) {
        window.chowStore.updateDish(store.id, d.dishId, payload);
        window.chowApp.toast(`"${d.name}" updated successfully!`, 'success');
      } else {
        // addDish returns the stored dish, whose id is the key the server uses.
        const saved = window.chowStore.addDish(store.id, payload);
        serverId = (saved && saved.id) || null;
        window.chowApp.toast(`"${d.name}" published to menu!`, 'success');
      }

      // Draft successfully published - clear saved draft
      localStorage.removeItem('chow45_vendor_food_draft');
      this.renderDraftsSection();

      const msg = document.getElementById('vnd-success-message');
      if (msg) msg.innerText = `"${d.name}" is now live on your Chow45 menu.`;

      this.goToStep(7);
    } catch (err) {
      const errMsg = err.message || 'An unexpected error occurred while publishing.';
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerText = `⚠️ Food upload error: ${errMsg}`;
      }
      window.chowApp.toast(`Upload error: ${errMsg}`, 'danger');
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerText = originalBtnText;
      }
    }
  },

  // ---------------------------------------------------------------
  // 4-Step vendor onboarding wizard
  // ---------------------------------------------------------------
  openRegistrationModal() {
    this.regStep = 1;
    this.appDraft.pickupLocation = null;
    this._applyPickup();
    this.updateRegStepUI();
    document.getElementById('vendor-register-modal').classList.add('open');
  },

  closeRegistrationModal() {
    document.getElementById('vendor-register-modal').classList.remove('open');
    this.render();
  },

  setRegStep(step) {
    // Light validation as the vendor walks forward.
    if (step > this.regStep) {
      if (step === 2 && !document.getElementById('v-reg-owner-name').value.trim() && !document.getElementById('v-reg-owner-name').value) {
        window.chowApp.toast('Please write your full name', 'warning');
        return;
      }
    }
    this.regStep = step;
    this.updateRegStepUI();
  },

  updateRegStepUI() {
    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`v-reg-step-${i}`);
      if (stepEl) stepEl.style.display = i === this.regStep ? 'block' : 'none';
    }
    const indicator = document.getElementById('v-reg-indicator');
    if (indicator) indicator.innerText = `Step ${this.regStep} of 4`;
  },

  _readTime(prefix) {
    const h = document.getElementById(`v-reg-${prefix}-hour`).value;
    const m = document.getElementById(`v-reg-${prefix}-min`).value;
    const ampm = document.getElementById(`v-reg-${prefix}-ampm`).value;
    return `${h}:${m} ${ampm}`;
  },

  async submitVendorRegistration() {
    const ownerName = document.getElementById('v-reg-owner-name').value.trim();
    const phone = document.getElementById('v-reg-phone').value.trim();
    const email = document.getElementById('v-reg-email').value.trim();
    const password = document.getElementById('v-reg-password').value;

    if (!ownerName) {
      window.chowApp.toast('Please enter your full name', 'warning');
      this.setRegStep(1);
      return;
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      window.chowApp.toast('Please enter a valid email address', 'warning');
      this.setRegStep(1);
      return;
    }
    if (!password || password.length < 4) {
      window.chowApp.toast('Please create a password (4+ characters)', 'warning');
      this.setRegStep(1);
      return;
    }

    const storeName = document.getElementById('v-reg-store-name').value.trim();
    if (!storeName) {
      window.chowApp.toast('Please enter your store name', 'warning');
      this.setRegStep(2);
      return;
    }
    const address = document.getElementById('v-reg-address').value.trim();
    if (!address) {
      window.chowApp.toast('Pick a pickup address on the map or use your current location', 'warning');
      this.setRegStep(2);
      return;
    }

    const pickup = this.appDraft.pickupLocation;

    const payload = {
      storeName,
      ownerName,
      phone: phone || '+234 800 000 0000',
      email,
      password,
      storePhone: document.getElementById('v-reg-store-phone').value.trim(),
      cuisine: document.getElementById('v-reg-cuisine').value.trim() || 'Nigerian Specialties',
      address,
      pickupLat: pickup ? pickup.latitude : null,
      pickupLng: pickup ? pickup.longitude : null,
      pickupAddress: pickup ? this._pickupLabel(pickup) : address,
      lga: document.getElementById('v-reg-lga').value,
      openingTime: this._readTime('open'),
      closingTime: this._readTime('close'),
      coverImg: this.appDraft.bannerDataUrl || null
    };

    const serverApp = await this._submitApplication(payload);
    if (!serverApp) {
      window.chowApp.toast('Server unreachable — application saved on this device', 'info');
    }

    window.chowStore.registerVendor(Object.assign({}, payload, {
      applicationId: serverApp ? serverApp.applicationId : undefined
    }));

    this.appDraft.bannerDataUrl = null;
    const preview = document.getElementById('v-reg-banner-preview');
    if (preview) preview.style.display = 'none';
    const pick = document.getElementById('v-reg-banner-pick');
    if (pick) pick.style.display = 'block';
    const changeBtn = document.getElementById('v-reg-banner-change');
    if (changeBtn) changeBtn.style.display = 'none';

    this.setRegStep(4); // Verification holding screen
    window.chowApp.toast('Application submitted for admin verification!', 'success');
  }
};

// Backwards-compatible alias used by earlier markup.
VendorController.openRegistration = VendorController.openRegistrationModal;

window.VendorController = VendorController;