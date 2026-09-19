/**
 * CHOW45 CUSTOMER EXPERIENCE CONTROLLER
 * Discovery, food customization, single-store cart, checkout, and tracking
 */

const CustomerController = {
  activeRestaurant: null,
  activeCustomizingDish: null,
  selectedAddons: [],
  customizingQty: 1,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('market-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        window.chowStore.setSearchQuery(e.target.value.trim());
      });
    }

    // Subscribe to state changes
    window.chowStore.subscribe(() => {
      this.render();
    });
  },

  render() {
    this.renderCategories();
    this.renderStores();
    this.renderCartBadge();
  },

  renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    const activeCat = window.chowStore.state.activeCategory;
    container.innerHTML = CHOW45_CATEGORIES.map(cat => `
      <div class="category-card ${activeCat === cat.id ? 'active' : ''}" onclick="CustomerController.selectCategory('${cat.id}')">
        <img class="category-img" src="${cat.img}" alt="${cat.name}" loading="lazy" />
        <span class="category-name">${cat.name}</span>
      </div>
    `).join('');
  },

  selectCategory(catId) {
    window.chowStore.setCategory(catId);
  },

  renderStores() {
    const container = document.getElementById('stores-grid');
    if (!container) return;

    const { restaurants, activeCategory, searchQuery } = window.chowStore.state;

    let filtered = restaurants.filter(r => {
      if (activeCategory === 'all') return true;
      if (activeCategory === 'campus') return r.isBudget;
      return r.category === activeCategory;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q)) ||
        r.menu.some(m => m.name.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px 16px; background: white; border-radius: var(--radius-xl); border: 1px dashed var(--c-border);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🍲</div>
          <h3 style="font-family: var(--font-display); font-size: 1.2rem; margin-bottom: 4px;">No food spots match your search</h3>
          <p style="color: var(--c-text-secondary); font-size: 0.88rem;">Try searching for Jollof, Amala, Suya, or reset category filter.</p>
          <button class="action-btn-secondary" style="margin-top: 16px;" onclick="window.chowStore.setCategory('all'); window.chowStore.setSearchQuery('');">View All Food Spots</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(store => `
      <div class="store-card" onclick="CustomerController.openStoreMenu('${store.id}')">
        <div class="store-thumb-wrap">
          <img class="store-thumb" src="${store.bannerImg}" alt="${store.name}" loading="lazy" />
          <div class="store-badge-open">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span> Open Now
          </div>
          ${store.isBudget ? `<div class="store-badge-promo">🎓 Campus Deal</div>` : ''}
        </div>
        <div class="store-content">
          <div class="store-name-row">
            <h3 class="store-title">${store.name}</h3>
            <span class="store-rating">★ ${store.rating}</span>
          </div>
          <div class="store-tags">${store.tags.join(' • ')}</div>
          <div class="store-meta-row">
            <span class="store-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${store.prepTime}
            </span>
            <span class="store-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${store.distanceKm} km away
            </span>
            <span class="store-meta-item" style="color: var(--c-primary); font-weight: 700;">
              Delivery ₦${store.deliveryFee.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  },

  openStoreMenu(storeId) {
    const store = window.chowStore.state.restaurants.find(r => r.id === storeId);
    if (!store) return;

    this.activeRestaurant = store;

    // Switch view to store detail
    document.getElementById('customer-home-section').style.display = 'none';
    const storeSection = document.getElementById('customer-store-section');
    storeSection.style.display = 'block';

    document.getElementById('store-detail-banner').src = store.bannerImg;
    document.getElementById('store-detail-name').innerText = store.name;
    document.getElementById('store-detail-tags').innerText = store.tags.join(' • ');
    document.getElementById('store-detail-meta').innerHTML = `
      <span>★ ${store.rating} (${store.reviewsCount} reviews)</span> • 
      <span>⏱ ${store.prepTime}</span> • 
      <span>📍 ${store.distanceKm} km away (₦${store.deliveryFee.toLocaleString()} delivery)</span>
    `;

    // Render Menu Items
    const menuGrid = document.getElementById('store-dishes-grid');
    menuGrid.innerHTML = store.menu.map(dish => `
      <div class="dish-card" onclick="CustomerController.openDishCustomizer('${dish.id}')">
        <div class="dish-info">
          <h4 class="dish-title">${dish.name}</h4>
          <p class="dish-desc">${dish.desc}</p>
          <div class="dish-price">₦${dish.price.toLocaleString()}</div>
        </div>
        <div class="dish-thumb-wrap">
          <img class="dish-thumb" src="${dish.img}" alt="${dish.name}" loading="lazy" />
          <button class="dish-add-btn" aria-label="Add ${dish.name}" ${!dish.inStock ? 'disabled style="background: #94A3B8;"' : ''}>
            ${dish.inStock ? '+' : '✕'}
          </button>
        </div>
      </div>
    `).join('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  closeStoreMenu() {
    document.getElementById('customer-store-section').style.display = 'none';
    document.getElementById('customer-home-section').style.display = 'block';
    this.activeRestaurant = null;
  },

  // -------------------------------------------------------------
  // Food Customization Modal (Add-ons & Quantities)
  // -------------------------------------------------------------
  openDishCustomizer(dishId) {
    if (!this.activeRestaurant) return;
    const dish = this.activeRestaurant.menu.find(d => d.id === dishId);
    if (!dish) return;

    if (!dish.inStock) {
      window.chowApp.toast('This delicious item is currently sold out for today.', 'warning');
      return;
    }

    this.activeCustomizingDish = dish;
    this.customizingQty = 1;
    this.selectedAddons = [];

    // Pre-select required options
    if (dish.addonGroups && dish.addonGroups.length > 0) {
      dish.addonGroups.forEach((group, gIdx) => {
        if (group.required && group.options.length > 0) {
          this.selectedAddons.push({
            groupTitle: group.title,
            name: group.options[0].name,
            price: group.options[0].price
          });
        }
      });
    }

    document.getElementById('custom-dish-banner').src = dish.img;
    document.getElementById('custom-dish-title').innerText = dish.name;
    document.getElementById('custom-dish-desc').innerText = dish.desc;
    document.getElementById('custom-dish-qty').innerText = this.customizingQty;

    this.renderCustomizerAddons(dish);
    this.updateCustomizerTotalBtn();

    document.getElementById('custom-dish-modal').classList.add('open');
  },

  renderCustomizerAddons(dish) {
    const container = document.getElementById('custom-addons-container');
    if (!dish.addonGroups || dish.addonGroups.length === 0) {
      container.innerHTML = `<p style="font-size: 0.85rem; color: var(--c-text-muted);">Standard single portion.</p>`;
      return;
    }

    container.innerHTML = dish.addonGroups.map((group, gIdx) => `
      <div class="addon-group">
        <div class="addon-group-title">${group.title}</div>
        <div class="addon-group-subtitle">${group.required ? 'Choose 1 (Required)' : 'Optional Extras'}</div>
        <div class="addon-options-list">
          ${group.options.map((opt, oIdx) => {
            const isSelected = this.selectedAddons.some(a => a.groupTitle === group.title && a.name === opt.name);
            const inputType = group.required ? 'radio' : 'checkbox';
            return `
              <label class="addon-option-row">
                <div class="addon-label-wrap">
                  <input type="${inputType}" name="addon_group_${gIdx}" ${isSelected ? 'checked' : ''} 
                    onchange="CustomerController.toggleAddon('${group.title}', '${opt.name}', ${opt.price}, ${group.required})" />
                  <span>${opt.name}</span>
                </div>
                <div class="addon-price-tag">${opt.price > 0 ? '+₦' + opt.price.toLocaleString() : (opt.price < 0 ? '-₦' + Math.abs(opt.price).toLocaleString() : 'Included')}</div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  },

  toggleAddon(groupTitle, optName, price, isRequired) {
    if (isRequired) {
      this.selectedAddons = this.selectedAddons.filter(a => a.groupTitle !== groupTitle);
      this.selectedAddons.push({ groupTitle, name: optName, price });
    } else {
      const idx = this.selectedAddons.findIndex(a => a.groupTitle === groupTitle && a.name === optName);
      if (idx > -1) {
        this.selectedAddons.splice(idx, 1);
      } else {
        this.selectedAddons.push({ groupTitle, name: optName, price });
      }
    }
    this.updateCustomizerTotalBtn();
  },

  changeCustomQty(delta) {
    this.customizingQty = Math.max(1, this.customizingQty + delta);
    document.getElementById('custom-dish-qty').innerText = this.customizingQty;
    this.updateCustomizerTotalBtn();
  },

  calculateCustomItemUnitPrice() {
    if (!this.activeCustomizingDish) return 0;
    const base = this.activeCustomizingDish.price;
    const addonsTotal = this.selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
    return Math.max(0, base + addonsTotal);
  },

  updateCustomizerTotalBtn() {
    const unitPrice = this.calculateCustomItemUnitPrice();
    const grandTotal = unitPrice * this.customizingQty;
    const btn = document.getElementById('custom-add-to-cart-btn');
    if (btn) {
      btn.innerText = `Add ${this.customizingQty} to Cart • ₦${grandTotal.toLocaleString()}`;
    }
  },

  confirmAddToCart() {
    if (!this.activeRestaurant || !this.activeCustomizingDish) return;

    const unitPrice = this.calculateCustomItemUnitPrice();
    const item = {
      dishId: this.activeCustomizingDish.id,
      name: this.activeCustomizingDish.name,
      img: this.activeCustomizingDish.img,
      unitPrice,
      qty: this.customizingQty,
      selectedAddons: [...this.selectedAddons],
      itemTotal: unitPrice * this.customizingQty
    };

    const added = window.chowStore.addToCart(
      this.activeRestaurant,
      item,
      (conflict) => this.showSingleStoreConflictModal(conflict)
    );

    if (added) {
      this.closeDishCustomizer();
      window.chowApp.toast(`Added ${item.qty}x ${item.name} to cart`, 'success');
    }
  },

  closeDishCustomizer() {
    document.getElementById('custom-dish-modal').classList.remove('open');
    this.activeCustomizingDish = null;
  },

  // -------------------------------------------------------------
  // "Single-Store Rule" (1 Cart = 1 Store) Conflict Modal
  // -------------------------------------------------------------
  showSingleStoreConflictModal(conflict) {
    this.closeDishCustomizer();
    const modal = document.getElementById('cart-conflict-modal');
    document.getElementById('conflict-existing-store').innerText = conflict.currentStoreName;
    document.getElementById('conflict-new-store').innerText = conflict.newStoreName;

    document.getElementById('conflict-confirm-clear-btn').onclick = () => {
      conflict.resolve(true);
      modal.classList.remove('open');
      window.chowApp.toast(`Started new order with ${conflict.newStoreName}`, 'success');
    };

    document.getElementById('conflict-cancel-btn').onclick = () => {
      conflict.resolve(false);
      modal.classList.remove('open');
    };

    modal.classList.add('open');
  },

  // -------------------------------------------------------------
  // Cart & Checkout
  // -------------------------------------------------------------
  renderCartBadge() {
    const count = window.chowStore.getCartCount();
    const badges = document.querySelectorAll('.cart-badge-count');
    badges.forEach(b => {
      b.innerText = count;
      b.style.display = count > 0 ? 'inline-block' : 'none';
    });
  },

  openCart() {
    const { cart, restaurants, selectedLocation } = window.chowStore.state;
    const modal = document.getElementById('cart-modal');
    const itemsList = document.getElementById('cart-items-list');

    if (cart.items.length === 0) {
      itemsList.innerHTML = `
        <div style="text-align: center; padding: 40px 16px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🛒</div>
          <h4 style="font-family: var(--font-display); font-size: 1.1rem; margin-bottom: 4px;">Your cart is empty</h4>
          <p style="color: var(--c-text-secondary); font-size: 0.85rem;">Discover Nigerian flavors and add delicious meals!</p>
        </div>
      `;
      document.getElementById('cart-checkout-footer').style.display = 'none';
      modal.classList.add('open');
      return;
    }

    const store = restaurants.find(r => r.id === cart.storeId);
    const subtotal = window.chowStore.getCartSubtotal();
    const serviceFee = MANDATORY_SERVICE_FEE;
    const deliveryFee = store ? store.deliveryFee : 400;
    const total = subtotal + serviceFee + deliveryFee;

    document.getElementById('cart-store-header-name').innerText = cart.storeName;

    itemsList.innerHTML = cart.items.map((item, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--c-border-subtle);">
        <div style="flex: 1; padding-right: 12px;">
          <div style="font-weight: 700; font-size: 0.92rem;">${item.name}</div>
          ${item.selectedAddons.length > 0 ? `
            <div style="font-size: 0.75rem; color: var(--c-text-muted); margin-top: 2px;">
              ${item.selectedAddons.map(a => a.name).join(', ')}
            </div>
          ` : ''}
          <div style="font-weight: 800; font-size: 0.88rem; color: var(--c-primary); margin-top: 4px;">
            ₦${item.itemTotal.toLocaleString()}
          </div>
        </div>
        <div class="qty-control" style="padding: 3px 8px;">
          <button class="qty-btn" onclick="window.chowStore.updateCartItemQty(${idx}, -1)">−</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn" onclick="window.chowStore.updateCartItemQty(${idx}, 1)">+</button>
        </div>
      </div>
    `).join('');

    // Update Pricing Breakdown
    document.getElementById('cart-subtotal-val').innerText = `₦${subtotal.toLocaleString()}`;
    document.getElementById('cart-service-fee-val').innerText = `₦${serviceFee.toLocaleString()}`;
    document.getElementById('cart-delivery-fee-val').innerText = `₦${deliveryFee.toLocaleString()}`;
    document.getElementById('cart-grand-total-val').innerText = `₦${total.toLocaleString()}`;

    // Delivery Address Preview
    document.getElementById('checkout-address-input').value = selectedLocation.name;

    document.getElementById('cart-checkout-footer').style.display = 'block';
    modal.classList.add('open');
  },

  closeCart() {
    document.getElementById('cart-modal').classList.remove('open');
  },

  placeOrder() {
    const { cart } = window.chowStore.state;
    if (cart.items.length === 0) return;

    const customerName = document.getElementById('checkout-name-input').value.trim() || 'Precious M.';
    const customerPhone = document.getElementById('checkout-phone-input').value.trim() || '+234 812 450 4500';
    const deliveryAddress = document.getElementById('checkout-address-input').value.trim();
    const deliveryNotes = document.getElementById('checkout-notes-input').value.trim();
    const paymentMethod = document.getElementById('checkout-payment-method').value;

    const newOrder = window.chowStore.createOrder({
      storeId: cart.storeId,
      storeName: cart.storeName,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      paymentMethod
    });

    this.closeCart();
    window.chowApp.toast('Payment verified! Order placed successfully 🎉', 'success');

    // Launch live order tracking
    this.openOrderTracking(newOrder.id);
  },

  // -------------------------------------------------------------
  // Live Mapbox Order Tracking View
  // -------------------------------------------------------------
  openOrderTracking(orderId) {
    const order = window.chowStore.state.orders.find(o => o.id === orderId);
    if (!order) return;

    const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId) || window.chowStore.state.restaurants[0];
    const location = window.chowStore.state.selectedLocation;

    // Switch view to tracking screen
    document.getElementById('customer-home-section').style.display = 'none';
    document.getElementById('customer-store-section').style.display = 'none';
    const trackSection = document.getElementById('customer-tracking-section');
    trackSection.style.display = 'block';

    // Update Drawer text
    document.getElementById('track-order-id').innerText = order.id;
    document.getElementById('track-order-pin').innerText = order.pin;
    document.getElementById('track-store-name').innerText = order.storeName;
    document.getElementById('track-dest-address').innerText = order.deliveryAddress;

    this.updateTrackingStatusUI(order);

    // Initialize Mapbox & Custom markers
    window.chowMap.renderDeliveryMission(order, store, location);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  updateTrackingStatusUI(order) {
    const stage = ORDER_STAGES[order.status] || ORDER_STAGES.PAID;
    document.getElementById('track-status-heading').innerText = stage.label;
    document.getElementById('track-status-subtext').innerText = stage.humanText;

    // Update stepper
    const segments = document.querySelectorAll('.tracking-stepper .stepper-segment');
    segments.forEach((seg, idx) => {
      seg.className = 'stepper-segment';
      if (idx < stage.stepIndex) seg.classList.add('completed');
      else if (idx === stage.stepIndex) seg.classList.add('active');
    });

    // ETA Pill
    const etaText = order.status === 'DELIVERED' ? 'Delivered' : (order.status === 'OUT_FOR_DELIVERY' ? 'Est: 8 mins' : 'Est: 20 mins');
    document.getElementById('track-eta-badge').innerText = etaText;
  },

  closeTracking() {
    document.getElementById('customer-tracking-section').style.display = 'none';
    document.getElementById('customer-home-section').style.display = 'block';
    if (window.chowMap) window.chowMap.clearMarkers();
  }
};
