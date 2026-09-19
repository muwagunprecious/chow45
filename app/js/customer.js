/**
 * CHOW45 CUSTOMER EXPERIENCE CONTROLLER
 * Discovery, food customization, single-store cart, checkout, live tracking,
 * search, profile, favorites, and post-delivery reviews.
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
    this.renderDiscoverySections();
    this.renderCartBadge();
    this.renderActiveFilterPills();
  },

  renderActiveFilterPills() {
    const currentFilter = window.chowStore.state.activeFilter;
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === currentFilter);
    });
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

  setFilter(filterId) {
    window.chowStore.setFilter(filterId);
  },

  renderDiscoverySections() {
    const container = document.getElementById('discovery-sections-container');
    if (!container) return;

    const { restaurants, activeCategory, activeFilter, searchQuery, userProfile } = window.chowStore.state;

    // Filter restaurants
    let filteredStores = [...restaurants];
    if (activeCategory !== 'all') {
      filteredStores = filteredStores.filter(r => r.category === activeCategory || r.menu.some(m => m.category === activeCategory));
    }

    if (activeFilter === 'fast') {
      filteredStores = filteredStores.filter(r => r.isFast);
    } else if (activeFilter === 'budget') {
      filteredStores = filteredStores.filter(r => r.isBudget || r.menu.some(m => m.price <= 2000));
    } else if (activeFilter === 'rating') {
      filteredStores = filteredStores.filter(r => r.rating >= 4.8);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredStores = filteredStores.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q)) ||
        r.menu.some(m => m.name.toLowerCase().includes(q))
      );
    }

    if (filteredStores.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; background: white; border-radius: var(--radius-xl); border: 1px dashed var(--c-border); margin: 24px 0;">
          <div style="font-size: 2.4rem; margin-bottom: 8px;">🍽️</div>
          <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; margin-bottom: 4px;">We couldn't find that.</h3>
          <p style="color: var(--c-text-secondary); font-size: 0.88rem; max-width: 360px; margin: 0 auto 16px;">
            Try searching for <strong>rice</strong>, <strong>chicken</strong>, <strong>suya</strong>, <strong>shawarma</strong>, or popular restaurants.
          </p>
          <button class="action-btn-secondary" onclick="window.chowStore.setCategory('all'); window.chowStore.setFilter('all'); window.chowStore.setSearchQuery('');">
            Explore All Food
          </button>
        </div>
      `;
      return;
    }

    // Extract all featured foods from stores
    const allDishes = [];
    filteredStores.forEach(store => {
      store.menu.forEach(dish => {
        allDishes.push({ ...dish, storeId: store.id, storeName: store.name });
      });
    });

    const popularDishes = allDishes.filter(d => d.isPopular || d.rating >= 4.8);

    container.innerHTML = `
      <!-- Section 1: Popular Near You (Food Cards with Instant + Button) -->
      <div style="margin-bottom: var(--space-32);">
        <div class="section-header">
          <div>
            <h2 class="section-title">Popular Near You</h2>
            <p style="font-size: 0.8rem; color: var(--c-text-secondary);">Most ordered dishes around Idimu & Lagos</p>
          </div>
          <span class="section-link" onclick="CustomerController.selectCategory('all')">See all</span>
        </div>
        <div class="food-cards-grid">
          ${popularDishes.slice(0, 4).map(dish => this.renderFoodCard(dish)).join('')}
        </div>
      </div>

      <!-- Section 2: Restaurants Near You -->
      <div style="margin-bottom: var(--space-32);">
        <div class="section-header">
          <div>
            <h2 class="section-title">Top Kitchens & Restaurants</h2>
            <p style="font-size: 0.8rem; color: var(--c-text-secondary);">Verified hygienic local food spots</p>
          </div>
        </div>
        <div class="stores-grid">
          ${filteredStores.map(store => this.renderStoreCard(store)).join('')}
        </div>
      </div>

      <!-- Section 3: Fast Delivery (Under 25 mins) -->
      <div style="margin-bottom: var(--space-32);">
        <div class="section-header">
          <div>
            <h2 class="section-title">⚡ Fast Delivery (Under 25 min)</h2>
            <p style="font-size: 0.8rem; color: var(--c-text-secondary);">Straight to your doorstep in minutes</p>
          </div>
        </div>
        <div class="food-cards-grid">
          ${allDishes.filter(d => d.prepTime && d.prepTime.includes('15')).slice(0, 4).map(dish => this.renderFoodCard(dish)).join('')}
        </div>
      </div>
    `;
  },

  renderFoodCard(dish) {
    const isFav = window.chowStore.state.userProfile.favorites.foods.includes(dish.id);

    return `
      <div class="food-card" onclick="CustomerController.handleFoodCardClick('${dish.storeId}', '${dish.id}')">
        <div class="food-card-thumb-wrap">
          <img class="food-card-thumb" src="${dish.img}" alt="${dish.name}" loading="lazy" />
          <button class="food-fav-btn ${isFav ? 'active' : ''}" title="Save to favorites" 
                  onclick="event.stopPropagation(); CustomerController.toggleFavFood('${dish.id}')">
            ${isFav ? '❤️' : '🤍'}
          </button>
          <div class="food-time-pill">${dish.prepTime || '20–30 min'}</div>
        </div>
        <div class="food-card-body">
          <div class="food-card-name">${dish.name}</div>
          <div class="food-card-store">${dish.storeName} • ★ ${dish.rating || 4.8}</div>
          <div class="food-card-bottom">
            <span class="food-card-price">₦${dish.price.toLocaleString()}</span>
            <button class="food-add-plus-btn" aria-label="Add ${dish.name}" 
                    onclick="event.stopPropagation(); CustomerController.handleQuickAdd('${dish.storeId}', '${dish.id}')">
              +
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderStoreCard(store) {
    return `
      <div class="store-card" onclick="CustomerController.openStoreMenu('${store.id}')">
        <div class="store-thumb-wrap">
          <img class="store-thumb" src="${store.bannerImg}" alt="${store.name}" loading="lazy" />
          <div class="store-badge-open">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span> Open Now
          </div>
          ${store.isBudget ? `<div class="store-badge-promo">🎓 Budget Deal</div>` : ''}
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
              ${store.distanceKm} km
            </span>
            <span class="store-meta-item" style="color: var(--c-primary); font-weight: 700;">
              ₦${store.deliveryFee.toLocaleString()} delivery
            </span>
          </div>
        </div>
      </div>
    `;
  },

  handleFoodCardClick(storeId, dishId) {
    const store = window.chowStore.state.restaurants.find(r => r.id === storeId);
    if (!store) return;
    this.activeRestaurant = store;
    this.openDishCustomizer(dishId);
  },

  handleQuickAdd(storeId, dishId) {
    const store = window.chowStore.state.restaurants.find(r => r.id === storeId);
    if (!store) return;
    const dish = store.menu.find(d => d.id === dishId);
    if (!dish) return;

    // If dish has required addon groups, open customization sheet
    const hasRequiredAddons = dish.addonGroups && dish.addonGroups.some(g => g.required);
    if (hasRequiredAddons) {
      this.activeRestaurant = store;
      this.openDishCustomizer(dishId);
      return;
    }

    // Direct 1-tap add to cart!
    const item = {
      dishId: dish.id,
      name: dish.name,
      img: dish.img,
      unitPrice: dish.price,
      qty: 1,
      selectedAddons: [],
      itemTotal: dish.price
    };

    const added = window.chowStore.addToCart(store, item, (conflict) => this.showSingleStoreConflictModal(conflict));
    if (added) {
      window.chowApp.toast(`Added ${dish.name} to cart (₦${dish.price.toLocaleString()})`, 'success');
    }
  },

  toggleFavFood(dishId) {
    const added = window.chowStore.toggleFavoriteFood(dishId);
    window.chowApp.toast(added ? 'Saved to favorites ❤️' : 'Removed from favorites', added ? 'success' : 'info');
  },

  openStoreMenu(storeId) {
    const store = window.chowStore.state.restaurants.find(r => r.id === storeId);
    if (!store) return;

    this.activeRestaurant = store;

    document.getElementById('customer-home-section').style.display = 'none';
    const storeSection = document.getElementById('customer-store-section');
    storeSection.style.display = 'block';

    document.getElementById('store-detail-banner').src = store.bannerImg;
    document.getElementById('store-detail-name').innerText = store.name;
    document.getElementById('store-detail-tags').innerText = store.tags.join(' • ');
    document.getElementById('store-detail-meta').innerHTML = `
      <span>★ ${store.rating} (${store.reviewsCount} reviews)</span> • 
      <span>⏱ ${store.prepTime}</span> • 
      <span>📍 ${store.address} (₦${store.deliveryFee.toLocaleString()} delivery)</span>
    `;

    const menuGrid = document.getElementById('store-dishes-grid');
    menuGrid.innerHTML = store.menu.map(dish => `
      <div class="dish-card" onclick="CustomerController.handleFoodCardClick('${store.id}', '${dish.id}')">
        <div class="dish-info">
          <h4 class="dish-title">${dish.name}</h4>
          <p class="dish-desc">${dish.desc}</p>
          <div class="dish-price">₦${dish.price.toLocaleString()}</div>
        </div>
        <div class="dish-thumb-wrap">
          <img class="dish-thumb" src="${dish.img}" alt="${dish.name}" loading="lazy" />
          <button class="dish-add-btn" aria-label="Add ${dish.name}" 
                  onclick="event.stopPropagation(); CustomerController.handleQuickAdd('${store.id}', '${dish.id}')"
                  ${!dish.inStock ? 'disabled style="background: #94A3B8;"' : ''}>
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
  // Food Customization Sheet (Add-ons & Quantities)
  // -------------------------------------------------------------
  openDishCustomizer(dishId) {
    if (!this.activeRestaurant) return;
    const dish = this.activeRestaurant.menu.find(d => d.id === dishId);
    if (!dish) return;

    if (!dish.inStock) {
      window.chowApp.toast('This delicious item is currently out of stock.', 'warning');
      return;
    }

    this.activeCustomizingDish = dish;
    this.customizingQty = 1;
    this.selectedAddons = [];

    if (dish.addonGroups && dish.addonGroups.length > 0) {
      dish.addonGroups.forEach((group) => {
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
    document.getElementById('custom-dish-store').innerText = this.activeRestaurant.name;
    document.getElementById('custom-dish-desc').innerText = dish.desc;
    document.getElementById('custom-dish-qty').innerText = this.customizingQty;

    this.renderCustomizerAddons(dish);
    this.updateCustomizerTotalBtn();

    document.getElementById('custom-dish-modal').classList.add('open');
  },

  renderCustomizerAddons(dish) {
    const container = document.getElementById('custom-addons-container');
    if (!dish.addonGroups || dish.addonGroups.length === 0) {
      container.innerHTML = `<p style="font-size: 0.85rem; color: var(--c-text-muted);">Standard full portion.</p>`;
      return;
    }

    container.innerHTML = dish.addonGroups.map((group, gIdx) => `
      <div class="addon-group">
        <div class="addon-group-title">${group.title}</div>
        <div class="addon-group-subtitle">${group.required ? 'Choose 1 (Required)' : 'Optional Extras'}</div>
        <div class="addon-options-list">
          ${group.options.map((opt) => {
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
      btn.innerText = `Add to Cart • ₦${grandTotal.toLocaleString()}`;
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
    const { cart, restaurants, selectedLocation, userProfile } = window.chowStore.state;
    const modal = document.getElementById('cart-modal');
    const itemsList = document.getElementById('cart-items-list');

    if (cart.items.length === 0) {
      itemsList.innerHTML = `
        <div style="text-align: center; padding: 48px 16px;">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">🛒</div>
          <h4 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; margin-bottom: 4px;">Your cart is waiting for something delicious</h4>
          <p style="color: var(--c-text-secondary); font-size: 0.85rem; margin-bottom: 20px;">Explore nearby kitchens and add your favorite Nigerian meals.</p>
          <button class="cta-primary-btn" onclick="CustomerController.closeCart()">Explore Food</button>
        </div>
      `;
      document.getElementById('cart-checkout-footer').style.display = 'none';
      modal.classList.add('open');
      return;
    }

    const store = restaurants.find(r => r.id === cart.storeId);
    const subtotal = window.chowStore.getCartSubtotal();
    const serviceFee = MANDATORY_SERVICE_FEE;
    const deliveryFee = store ? store.deliveryFee : 800;
    const total = subtotal + serviceFee + deliveryFee;

    document.getElementById('cart-store-header-name').innerText = cart.storeName;

    itemsList.innerHTML = cart.items.map((item, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--c-border-subtle);">
        <div style="flex: 1; padding-right: 12px;">
          <div style="font-weight: 700; font-size: 0.92rem;">${item.name}</div>
          ${item.selectedAddons && item.selectedAddons.length > 0 ? `
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

    // Update Pricing Breakdown matching Point 21 & 56
    document.getElementById('cart-subtotal-val').innerText = `₦${subtotal.toLocaleString()}`;
    document.getElementById('cart-service-fee-val').innerText = `₦${serviceFee.toLocaleString()}`;
    document.getElementById('cart-delivery-fee-val').innerText = `₦${deliveryFee.toLocaleString()}`;
    document.getElementById('cart-grand-total-val').innerText = `₦${total.toLocaleString()}`;

    // Delivery destination preview
    document.getElementById('checkout-address-input').value = selectedLocation.name;
    document.getElementById('checkout-name-input').value = userProfile.name;
    document.getElementById('checkout-phone-input').value = userProfile.phone;

    document.getElementById('cart-pay-cta-btn').innerText = `Pay ₦${total.toLocaleString()} & Place Order`;

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
    window.chowApp.toast('Payment successful! Order confirmed ✓', 'success');

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

    document.getElementById('customer-home-section').style.display = 'none';
    document.getElementById('customer-store-section').style.display = 'none';
    const trackSection = document.getElementById('customer-tracking-section');
    trackSection.style.display = 'block';

    document.getElementById('track-order-id').innerText = order.id;
    document.getElementById('track-order-pin').innerText = order.pin;
    document.getElementById('track-store-name').innerText = order.storeName;
    document.getElementById('track-dest-address').innerText = order.deliveryAddress;

    this.updateTrackingStatusUI(order);

    window.chowMap.renderDeliveryMission(order, store, location);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  updateTrackingStatusUI(order) {
    const stage = ORDER_STAGES[order.status] || ORDER_STAGES.PAID;
    document.getElementById('track-status-heading').innerText = stage.humanText;

    const segments = document.querySelectorAll('.tracking-stepper .stepper-segment');
    segments.forEach((seg, idx) => {
      seg.className = 'stepper-segment';
      if (idx < (stage.stepIndex || 1)) seg.classList.add('completed');
      else if (idx === (stage.stepIndex || 1)) seg.classList.add('active');
    });

    const etaText = order.status === 'DELIVERED' ? 'Delivered' : (order.status === 'OUT_FOR_DELIVERY' ? 'Est: 8 mins away' : 'Est: 25 mins');
    document.getElementById('track-eta-badge').innerText = etaText;
  },

  closeTracking() {
    document.getElementById('customer-tracking-section').style.display = 'none';
    document.getElementById('customer-home-section').style.display = 'block';
    if (window.chowMap) window.chowMap.clearMarkers();
  },

  // -------------------------------------------------------------
  // Order History & Reviews
  // -------------------------------------------------------------
  openOrderHistory() {
    const modal = document.getElementById('order-history-modal');
    const container = document.getElementById('order-history-list');
    if (!modal || !container) return;

    const { orders } = window.chowStore.state;
    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">📦</div>
          <p style="font-weight: 700;">You haven't placed an order yet.</p>
          <button class="cta-primary-btn" style="margin-top: 12px;" onclick="document.getElementById('order-history-modal').classList.remove('open')">Find Food</button>
        </div>
      `;
    } else {
      container.innerHTML = orders.map(order => `
        <div style="background: var(--c-bg-subtle); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <strong style="font-size: 1rem;">${order.storeName}</strong>
              <div style="font-size: 0.78rem; color: var(--c-text-muted);">#${order.id} • ${new Date(order.createdAt).toLocaleDateString()}</div>
            </div>
            <span class="table-status-tag" style="background: ${order.status === 'DELIVERED' ? 'var(--c-success-bg)' : 'var(--c-warning-bg)'}; color: ${order.status === 'DELIVERED' ? '#065F46' : '#92400E'};">
              ${ORDER_STAGES[order.status]?.label || order.status}
            </span>
          </div>

          <div style="font-size: 0.85rem; margin-bottom: 10px;">
            ${order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--c-border); padding-top: 8px;">
            <strong style="font-size: 0.95rem; color: var(--c-primary);">₦${order.total.toLocaleString()}</strong>
            <div style="display: flex; gap: 8px;">
              ${order.status === 'DELIVERED' ? `
                <button class="action-btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="CustomerController.openReviewModal('${order.id}')">Rate Order</button>
                <button class="action-btn-primary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="CustomerController.reorder('${order.id}')">Reorder</button>
              ` : `
                <button class="action-btn-primary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="CustomerController.openOrderTracking('${order.id}'); document.getElementById('order-history-modal').classList.remove('open');">Track Live</button>
              `}
            </div>
          </div>
        </div>
      `).join('');
    }

    modal.classList.add('open');
  },

  reorder(orderId) {
    const order = window.chowStore.state.orders.find(o => o.id === orderId);
    if (!order) return;
    const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId);
    if (!store) return;

    window.chowStore.clearCart();
    order.items.forEach(item => {
      window.chowStore.addToCart(store, item);
    });

    document.getElementById('order-history-modal').classList.remove('open');
    this.openCart();
    window.chowApp.toast('Items added to cart from past order!', 'success');
  },

  openReviewModal(orderId) {
    const modal = document.getElementById('review-modal');
    document.getElementById('review-order-id').innerText = orderId;
    modal.classList.add('open');
  },

  submitReview() {
    const orderId = document.getElementById('review-order-id').innerText;
    const comment = document.getElementById('review-comment-input').value.trim();
    window.chowStore.submitOrderReview(orderId, 5, comment || 'Great food and super fast delivery!');
    document.getElementById('review-modal').classList.remove('open');
    window.chowApp.toast('Thank you for rating your order! ⭐⭐⭐⭐⭐', 'success');
  }
};
