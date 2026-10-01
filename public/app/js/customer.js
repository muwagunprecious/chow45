/**
 * CHOW45 CUSTOMER EXPERIENCE CONTROLLER
 * Discovery, food customization, single-store cart, checkout, live tracking,
 * search, profile, favorites, and post-delivery reviews.
 */

function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CustomerController = {
  activeRestaurant: null,
  activeCustomizingDish: null,
  selectedAddons: [],
  customizingQty: 1,
  _esc,

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
        (Array.isArray(r.tags) ? r.tags : []).some(t => String(t || '').toLowerCase().includes(q)) ||
        (Array.isArray(r.menu) ? r.menu : []).some(m => String(m.name || '').toLowerCase().includes(q))
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
    const isOut = dish.status === 'OUT_OF_STOCK' || dish.inStock === false;
    const isPreorder = Boolean(dish.preorderEnabled) && !isOut;

    // Pricing unit formatting (Point 10)
    const priceLabel = this._dishPriceLabel(dish);

    // Status pill
    let statusPill = `<div class="food-time-pill">${dish.prepTime || '20–30 min'}</div>`;
    if (isOut) {
      statusPill = `<div class="food-time-pill" style="background:#B91C1C;">Out of stock</div>`;
    } else if (isPreorder) {
      statusPill = `<div class="food-time-pill" style="background:#92400E;">🟡 Pre-order · ${dish.preorderDate || 'Soon'}</div>`;
    }

    return `
      <div class="food-card ${isOut ? 'is-out-of-stock' : ''}" style="${isOut ? 'opacity:0.75;' : ''}" onclick="CustomerController.handleFoodCardClick('${dish.storeId}', '${dish.id}')">
        <div class="food-card-thumb-wrap">
          <img class="food-card-thumb" src="${dish.img}" alt="${dish.name}" loading="lazy" />
          <button class="food-fav-btn ${isFav ? 'active' : ''}" title="Save to favorites" 
                  onclick="event.stopPropagation(); CustomerController.toggleFavFood('${dish.id}')">
            ${isFav ? '❤️' : '🤍'}
          </button>
          ${statusPill}
        </div>
        <div class="food-card-body">
          <div class="food-card-name">${dish.name}</div>
          <div class="food-card-store">${dish.storeName} • ★ ${dish.rating || 4.8}</div>
          <div class="food-card-bottom">
            <span class="food-card-price">${priceLabel}</span>
            ${isOut ? `
              <span style="font-size:0.75rem;font-weight:700;color:#DC2626;">Unavailable</span>
            ` : isPreorder ? `
              <button class="food-add-plus-btn" style="width:auto;padding:4px 10px;border-radius:999px;font-size:0.75rem;font-weight:700;" aria-label="Pre-order ${dish.name}"
                      onclick="event.stopPropagation(); CustomerController.handleFoodCardClick('${dish.storeId}', '${dish.id}')">
                Pre-order
              </button>
            ` : `
              <button class="food-add-plus-btn" aria-label="Add ${dish.name}" 
                      onclick="event.stopPropagation(); CustomerController.handleQuickAdd('${dish.storeId}', '${dish.id}')">
                +
              </button>
            `}
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
          <div class="store-tags">${(Array.isArray(store.tags) ? store.tags : (store.cuisine ? [store.cuisine] : ['Verified Store'])).join(' • ')}</div>
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
              ${formatNaira(store.deliveryFee)} delivery
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

    // If dish has required addon groups, compulsory extras, scoop/plate portion
    // options, or sizes, open customizer. Sizes are required, so they cannot
    // take the 1-tap path or the item would land in the cart unpriced.
    const hasRequiredAddons = (dish.addonGroups && dish.addonGroups.some(g => g.required)) ||
                              (dish.compulsoryExtras && dish.compulsoryExtras.length > 0) ||
                              dish.priceType === 'BOTH' ||
                              window.ChowUnits.hasSizes(dish);
    if (hasRequiredAddons) {
      this.activeRestaurant = store;
      this.openDishCustomizer(dishId);
      return;
    }

    // Direct 1-tap add to cart!
    const unitPrice = window.ChowUnits.baseUnitPrice(dish, null);
    const item = {
      dishId: dish.id,
      name: dish.name,
      img: dish.img,
      unitPrice,
      qty: 1,
      selectedAddons: [],
      itemTotal: unitPrice
    };

    const added = window.chowStore.addToCart(store, item, (conflict) => this.showSingleStoreConflictModal(conflict));
    if (added) {
      window.chowApp.toast(`Added ${dish.name} to cart (${formatNaira(unitPrice)})`, 'success');
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
    const storeDetailTags = Array.isArray(store.tags) ? store.tags : (store.cuisine ? [store.cuisine] : ['Verified Store']);
    document.getElementById('store-detail-tags').innerText = storeDetailTags.join(' • ');
    document.getElementById('store-detail-meta').innerHTML = `
      <span>★ ${store.rating} (${store.reviewsCount} reviews)</span> • 
      <span>⏱ ${store.prepTime}</span> • 
      <span>📍 ${store.address} (${formatNaira(store.deliveryFee)} delivery)</span>
    `;

    const menuGrid = document.getElementById('store-dishes-grid');
    menuGrid.innerHTML = store.menu.map(dish => {
      const isOut = dish.status === 'OUT_OF_STOCK' || dish.inStock === false;
      const isPreorder = Boolean(dish.preorderEnabled) && !isOut;

      const priceLabel = this._dishPriceLabel(dish);

      return `
        <div class="dish-card ${isOut ? 'is-out-of-stock' : ''}" style="${isOut ? 'opacity:0.7;' : ''}" onclick="CustomerController.handleFoodCardClick('${store.id}', '${dish.id}')">
          <div class="dish-info">
            <h4 class="dish-title">${dish.name}</h4>
            <p class="dish-desc">${dish.desc || ''}</p>
            <div class="dish-price">${priceLabel}</div>
            ${isOut ? '<div style="font-size:0.75rem;font-weight:700;color:#DC2626;margin-top:4px;">Out of stock</div>' : ''}
            ${isPreorder ? `<div style="font-size:0.75rem;font-weight:700;color:#92400E;margin-top:4px;">🟡 Pre-order · ${dish.preorderDate || 'Soon'}</div>` : ''}
          </div>
          <div class="dish-thumb-wrap">
            <img class="dish-thumb" src="${dish.img}" alt="${dish.name}" loading="lazy" />
            <button class="dish-add-btn" aria-label="Add ${dish.name}" 
                    onclick="event.stopPropagation(); CustomerController.handleQuickAdd('${store.id}', '${dish.id}')"
                    ${isOut ? 'disabled style="background: #94A3B8; cursor:not-allowed;"' : ''}>
              ${isOut ? '✕' : '+'}
            </button>
          </div>
        </div>
      `;
    }).join('');

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
  // -------------------------------------------------------------
  // Food Customization Sheet (Add-ons, Portions & Quantities)
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
    this.selectedSizeId = null;

    const units = window.ChowUnits;

    // Sizes replace the portion picker entirely: a by-piece item is not
    // sold by scoop, so showing both would be contradictory.
    const dishHasSizes = units.hasSizes(dish);
    const sizeWrap = document.getElementById('custom-size-select-wrap');
    const sizeGrid = document.getElementById('custom-size-grid');

    if (dishHasSizes) {
      if (sizeWrap) sizeWrap.style.display = 'block';
      if (sizeGrid) {
        sizeGrid.innerHTML = dish.sizes.map(s => `
          <button type="button" class="custom-size-card" role="radio" aria-checked="false"
                  data-size-id="${this._esc(s.id)}"
                  onclick="CustomerController.selectCustomSize('${this._esc(s.id)}')">
            <span class="custom-size-name">${this._esc(s.name)}</span>
            <span class="custom-size-price">${formatNaira(s.price)}</span>
          </button>
        `).join('');
      }
    } else if (sizeWrap) {
      sizeWrap.style.display = 'none';
    }

    // Default portion type
    this.selectedPortionType = dish.priceType === 'SCOOP' ? 'SCOOP' : 'PLATE';

    // Handle portion selector UI (Scoop vs Plate)
    const portionSelectWrap = document.getElementById('custom-portion-select-wrap');
    const portionSingleWrap = document.getElementById('custom-portion-single-wrap');
    const scoopCard = document.getElementById('custom-portion-scoop');
    const plateCard = document.getElementById('custom-portion-plate');
    const singleBadge = document.getElementById('custom-portion-single-badge');

    if (dishHasSizes) {
      // Sizes already carry the price, so the portion UI stays hidden.
      if (portionSelectWrap) portionSelectWrap.style.display = 'none';
      if (portionSingleWrap) portionSingleWrap.style.display = 'none';
    } else if (dish.priceType === 'BOTH') {
      if (portionSelectWrap) portionSelectWrap.style.display = 'block';
      if (portionSingleWrap) portionSingleWrap.style.display = 'none';

      const scoopPriceEl = document.getElementById('custom-portion-scoop-price');
      const platePriceEl = document.getElementById('custom-portion-plate-price');
      if (scoopPriceEl) scoopPriceEl.innerText = formatNaira(dish.scoopPrice || dish.price);
      if (platePriceEl) platePriceEl.innerText = formatNaira(dish.platePrice || dish.price);

      if (scoopCard) scoopCard.classList.toggle('selected', this.selectedPortionType === 'SCOOP');
      if (plateCard) plateCard.classList.toggle('selected', this.selectedPortionType === 'PLATE');
    } else if (dish.priceType === 'SCOOP') {
      if (portionSelectWrap) portionSelectWrap.style.display = 'none';
      if (portionSingleWrap) {
        portionSingleWrap.style.display = 'block';
        if (singleBadge) singleBadge.innerHTML = `🥄 Price: ${formatNaira(dish.scoopPrice || dish.price)} / scoop`;
      }
    } else if (dish.priceType === 'PLATE') {
      if (portionSelectWrap) portionSelectWrap.style.display = 'none';
      if (portionSingleWrap) {
        portionSingleWrap.style.display = 'block';
        if (singleBadge) singleBadge.innerHTML = `🍽️ Price: ${formatNaira(dish.platePrice || dish.price)} / plate`;
      }
    } else if (String(dish.priceType || '').toUpperCase() === 'PIECE') {
      // By-piece item with a single flat price.
      if (portionSelectWrap) portionSelectWrap.style.display = 'none';
      if (portionSingleWrap) {
        portionSingleWrap.style.display = 'block';
        if (singleBadge) {
          singleBadge.innerHTML = `🥟 Price: ${formatNaira(dish.piecePrice || dish.price)} / piece`;
        }
      }
    } else {
      if (portionSelectWrap) portionSelectWrap.style.display = 'none';
      if (portionSingleWrap) portionSingleWrap.style.display = 'none';
    }

    // Auto-select compulsory extras if defined
    if (dish.compulsoryExtras && dish.compulsoryExtras.length > 0) {
      this.selectedAddons.push({
        groupTitle: 'Choose compulsory extra',
        name: dish.compulsoryExtras[0].name,
        price: Number(dish.compulsoryExtras[0].price) || 0
      });
    } else if (dish.addonGroups && dish.addonGroups.length > 0) {
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
    document.getElementById('custom-dish-desc').innerText = dish.desc || '';
    document.getElementById('custom-dish-qty').innerText = this.customizingQty;

    this._updateCustomQtySub();
    this.renderCustomizerAddons(dish);
    this.updateCustomizerTotalBtn();

    document.getElementById('custom-dish-modal').classList.add('open');
  },

  // "1 piece" / "2 pieces" / "1 scoop" / "2 plates". A sized item reads as
  // "1 Small" because that is the unit the customer actually chose.
  _updateCustomQtySub() {
    const sub = document.getElementById('custom-dish-qty-sub');
    if (!sub) return;

    const dish = this.activeCustomizingDish;
    if (!dish) return;

    if (window.ChowUnits.hasSizes(dish)) {
      const chosen = (dish.sizes || []).find(s => s.id === this.selectedSizeId);
      if (chosen) {
        sub.innerText = `${this.customizingQty} x ${chosen.name}`;
      } else {
        sub.innerText = `Choose a size • ${this.customizingQty} total`;
      }
      return;
    }

    sub.innerText = `${this.customizingQty} ${window.ChowUnits.pluralUnitLabel(
      dish.priceType, this.customizingQty
    )}`;
  },

  selectCustomSize(sizeId) {
    this.selectedSizeId = sizeId;

    document.querySelectorAll('#custom-size-grid .custom-size-card').forEach(card => {
      const isChosen = card.getAttribute('data-size-id') === sizeId;
      card.classList.toggle('selected', isChosen);
      card.setAttribute('aria-checked', isChosen ? 'true' : 'false');
    });

    this._updateCustomQtySub();
    this.updateCustomizerTotalBtn();
  },

  selectCustomPortion(type) {
    this.selectedPortionType = type;
    const scoopCard = document.getElementById('custom-portion-scoop');
    const plateCard = document.getElementById('custom-portion-plate');
    if (scoopCard) scoopCard.classList.toggle('selected', type === 'SCOOP');
    if (plateCard) plateCard.classList.toggle('selected', type === 'PLATE');

    this._updateCustomQtySub();
    this.updateCustomizerTotalBtn();
  },

  _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Menu card price. Shared by the featured and full menu renderers so the
  // two cannot drift apart. A sized item leads with its cheapest size.
  _dishPriceLabel(dish) {
    const unit = '<span style="font-size:0.75rem;font-weight:600;color:var(--c-text-muted);">';
    const pType = String(dish.priceType || '').toUpperCase();
    const lowestSize = window.ChowUnits.lowestSizePrice(dish);

    if (lowestSize !== null) {
      return `From ${formatNaira(lowestSize)} ${unit}/ size</span>`;
    }

    if (pType === 'SCOOP') {
      return `${formatNaira(dish.scoopPrice || dish.price)} ${unit}/ scoop</span>`;
    }
    if (pType === 'PLATE') {
      return `${formatNaira(dish.platePrice || dish.price)} ${unit}/ plate</span>`;
    }
    if (pType === 'BOTH') {
      const minP = Math.min(dish.scoopPrice || dish.price || 0, dish.platePrice || dish.price || 0);
      return `From ${formatNaira(minP)}`;
    }
    if (pType === 'PIECE') {
      return `${formatNaira(dish.piecePrice || dish.price)} ${unit}/ piece</span>`;
    }

    return formatNaira(dish.price);
  },

  renderCustomizerAddons(dish) {
    const container = document.getElementById('custom-addons-container');
    if (!container) return;

    // Check if new structured compulsory/optional extras exist
    const hasCompulsory = dish.compulsoryExtras && dish.compulsoryExtras.length > 0;
    const hasOptional = dish.optionalExtras && dish.optionalExtras.length > 0;

    if (hasCompulsory || hasOptional) {
      let html = '';

      if (hasCompulsory) {
        html += `
          <div class="addon-group">
            <div class="addon-group-title">Choose compulsory extra</div>
            <div class="addon-group-subtitle">Choose 1 (Required)</div>
            <div class="addon-options-list">
              ${dish.compulsoryExtras.map((opt, idx) => {
                const isSelected = this.selectedAddons.some(a => a.groupTitle === 'Choose compulsory extra' && a.name === opt.name);
                return `
                  <label class="addon-option-row">
                    <div class="addon-label-wrap">
                      <input type="radio" name="compulsory_extra_choice" ${isSelected ? 'checked' : ''} 
                        onchange="CustomerController.selectCompulsoryExtraByIndex(${idx})" />
                      <span>${_esc(opt.name)}</span>
                    </div>
                    <div class="addon-price-tag">+₦${(Number(opt.price) || 0).toLocaleString()}</div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      if (hasOptional) {
        html += `
          <div class="addon-group" style="margin-top: 14px;">
            <div class="addon-group-title">Optional extras</div>
            <div class="addon-group-subtitle">Choose 0 or more</div>
            <div class="addon-options-list">
              ${dish.optionalExtras.map((opt, idx) => {
                const isSelected = this.selectedAddons.some(a => a.groupTitle === 'Optional extras' && a.name === opt.name);
                return `
                  <label class="addon-option-row">
                    <div class="addon-label-wrap">
                      <input type="checkbox" ${isSelected ? 'checked' : ''} 
                        onchange="CustomerController.toggleOptionalExtraByIndex(${idx})" />
                      <span>${_esc(opt.name)}</span>
                    </div>
                    <div class="addon-price-tag">+₦${(Number(opt.price) || 0).toLocaleString()}</div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      container.innerHTML = html;
      return;
    }

    // Fallback to legacy addonGroups
    if (!dish.addonGroups || dish.addonGroups.length === 0) {
      container.innerHTML = `<p style="font-size: 0.85rem; color: var(--c-text-muted);">Standard full portion.</p>`;
      return;
    }

    container.innerHTML = dish.addonGroups.map((group, gIdx) => `
      <div class="addon-group">
        <div class="addon-group-title">${_esc(group.title)}</div>
        <div class="addon-group-subtitle">${group.required ? 'Choose 1 (Required)' : 'Optional Extras'}</div>
        <div class="addon-options-list">
          ${group.options.map((opt, oIdx) => {
            const isSelected = this.selectedAddons.some(a => a.groupTitle === group.title && a.name === opt.name);
            const inputType = group.required ? 'radio' : 'checkbox';
            return `
              <label class="addon-option-row">
                <div class="addon-label-wrap">
                  <input type="${inputType}" name="addon_group_${gIdx}" ${isSelected ? 'checked' : ''} 
                    onchange="CustomerController.toggleAddonByIndex(${gIdx}, ${oIdx})" />
                  <span>${_esc(opt.name)}</span>
                </div>
                <div class="addon-price-tag">${opt.price > 0 ? '+₦' + opt.price.toLocaleString() : (opt.price < 0 ? '-₦' + Math.abs(opt.price).toLocaleString() : 'Included')}</div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  },

  selectCompulsoryExtraByIndex(idx) {
    const dish = this.activeCustomizingDish;
    if (!dish || !dish.compulsoryExtras || !dish.compulsoryExtras[idx]) return;
    const opt = dish.compulsoryExtras[idx];
    this.selectCompulsoryExtra(opt.name, opt.price);
  },

  toggleOptionalExtraByIndex(idx) {
    const dish = this.activeCustomizingDish;
    if (!dish || !dish.optionalExtras || !dish.optionalExtras[idx]) return;
    const opt = dish.optionalExtras[idx];
    this.toggleOptionalExtra(opt.name, opt.price);
  },

  toggleAddonByIndex(gIdx, oIdx) {
    const dish = this.activeCustomizingDish;
    if (!dish || !dish.addonGroups || !dish.addonGroups[gIdx]) return;
    const group = dish.addonGroups[gIdx];
    const opt = group.options && group.options[oIdx];
    if (!opt) return;
    this.toggleAddon(group.title, opt.name, opt.price, group.required);
  },

  selectCompulsoryExtra(name, price) {
    this.selectedAddons = this.selectedAddons.filter(a => a.groupTitle !== 'Choose compulsory extra');
    this.selectedAddons.push({ groupTitle: 'Choose compulsory extra', name, price: Number(price) || 0 });
    this.updateCustomizerTotalBtn();
  },

  toggleOptionalExtra(name, price) {
    const idx = this.selectedAddons.findIndex(a => a.groupTitle === 'Optional extras' && a.name === name);
    if (idx > -1) {
      this.selectedAddons.splice(idx, 1);
    } else {
      this.selectedAddons.push({ groupTitle: 'Optional extras', name, price: Number(price) || 0 });
    }
    this.updateCustomizerTotalBtn();
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

    this._updateCustomQtySub();
    this.updateCustomizerTotalBtn();
  },

  calculateCustomItemUnitPrice() {
    const dish = this.activeCustomizingDish;
    if (!dish) return 0;

    // A chosen size replaces the base price; before one is picked the
    // per-piece price is the fallback so the total is never a surprise.
    // The selected portion matters for dishes sold as both scoop and plate.
    const base = window.ChowUnits.baseUnitPrice(dish, this.selectedSizeId, this.selectedPortionType);

    const addonsTotal = this.selectedAddons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    return Math.max(0, base + addonsTotal);
  },

  updateCustomizerTotalBtn() {
    const unitPrice = this.calculateCustomItemUnitPrice();
    const grandTotal = unitPrice * this.customizingQty;
    const btn = document.getElementById('custom-add-to-cart-btn');

    if (btn) {
      // Until a size is chosen the total is not final, so the button asks for
      // the choice instead of presenting an amount that will change.
      const needsSize = Boolean(
        this.activeCustomizingDish &&
        window.ChowUnits.hasSizes(this.activeCustomizingDish) &&
        !this.selectedSizeId
      );

      btn.innerText = needsSize
        ? 'Choose a size to continue'
        : `Add to Cart • ${formatNaira(grandTotal)}`;
      btn.classList.toggle('is-pending', needsSize);
    }
  },

  confirmAddToCart() {
    if (!this.activeRestaurant || !this.activeCustomizingDish) return;
    const dish = this.activeCustomizingDish;

    // Sizes are required, so a sized item cannot reach the cart unpriced.
    const chosenSize = window.ChowUnits.hasSizes(dish)
      ? (dish.sizes || []).find(s => s.id === this.selectedSizeId)
      : null;

    if (window.ChowUnits.hasSizes(dish) && !chosenSize) {
      window.chowApp.toast('Please choose a size', 'warning');
      const wrap = document.getElementById('custom-size-select-wrap');
      if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Validate compulsory extra
    if (dish.compulsoryExtras && dish.compulsoryExtras.length > 0) {
      const hasComp = this.selectedAddons.some(a => a.groupTitle === 'Choose compulsory extra');
      if (!hasComp) {
        window.chowApp.toast('Please choose a compulsory extra', 'warning');
        return;
      }
    }

    const unitPrice = this.calculateCustomItemUnitPrice();
    let portionLabel = '';

    if (chosenSize) {
      portionLabel = ` (${chosenSize.name})`;
    } else if (dish.priceType === 'BOTH') {
      portionLabel = this.selectedPortionType === 'SCOOP' ? ' (Per Scoop)' : ' (Per Plate)';
    } else if (dish.priceType === 'SCOOP') {
      portionLabel = ' (Per Scoop)';
    } else if (dish.priceType === 'PLATE') {
      portionLabel = ' (Per Plate)';
    } else if (String(dish.priceType || '').toUpperCase() === 'PIECE') {
      portionLabel = ' (Per Piece)';
    }

    const item = {
      dishId: dish.id,
      name: dish.name + portionLabel,
      img: dish.img,
      unitPrice,
      qty: this.customizingQty,
      sizeId: chosenSize ? chosenSize.id : null,
      sizeName: chosenSize ? chosenSize.name : null,
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
    this.selectedSizeId = null;
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
    const config = window.chowStore.state.deliveryConfig || DEFAULT_DELIVERY_FEE_CONFIG;
    const subtotal = window.chowStore.getCartSubtotal();
    const serviceFee = config.serviceFee;
    const deliveryFee = calculateDeliveryFee((store ? store.distanceKm : 1.8) * 1000, config);
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
            ${formatNaira(item.itemTotal)}
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
    document.getElementById('cart-subtotal-val').innerText = formatNaira(subtotal);
    document.getElementById('cart-service-fee-val').innerText = formatNaira(serviceFee);
    document.getElementById('cart-delivery-fee-val').innerText = formatNaira(deliveryFee);
    document.getElementById('cart-grand-total-val').innerText = formatNaira(total);

    // Delivery destination preview
    document.getElementById('checkout-address-input').value = selectedLocation.name;
    document.getElementById('checkout-name-input').value = userProfile.name;
    document.getElementById('checkout-phone-input').value = userProfile.phone;

    document.getElementById('cart-pay-cta-btn').innerText = `Pay ${formatNaira(total)} & Place Order`;

    document.getElementById('cart-checkout-footer').style.display = 'block';
    modal.classList.add('open');

    // Live distance-based delivery quote (Mapbox route + server-validated price)
    this.quoteCache = null;
    this.refreshDeliveryQuote(store);
  },

  /**
   * Fetch the live delivery route from the restaurant's coordinates to the
   * user's selected delivery location and reconcile the cart's delivery fee.
   */
  async refreshDeliveryQuote(store) {
    const row = document.getElementById('cart-delivery-quote');
    const state = window.chowStore.state;
    const loc = state.selectedLocation;
    if (!row || !store || !loc) return;
    if (!window.chowMap || typeof window.chowMap.getDeliveryQuote !== 'function') return;

    const availability = getServiceAvailability({ lng: loc.longitude ?? loc.lng, lat: loc.latitude ?? loc.lat });
    row.style.display = 'block';

    if (!availability.available) {
      row.innerHTML = `
        <div class="dq-block">
          <span class="dq-icon">⚠️</span>
          <div><strong>${availability.title || 'Delivery unavailable'}</strong><span>${availability.message}</span></div>
        </div>`;
      return;
    }

    row.innerHTML = `
      <div class="dq-block">
        <span class="dq-icon">🚴</span>
        <div><strong>Calculating live delivery…</strong><span>Trying the fastest Ogun State route</span></div>
      </div>`;

    let quote = null;
    try {
      quote = await window.chowMap.getDeliveryQuote(store, loc);
    } catch (e) {
      console.warn('Delivery quote failed:', e);
    }

    if (quote && typeof quote.deliveryFee === 'number') {
      this.quoteCache = quote;
      const fee = quote.deliveryFee;
      const config = window.chowStore.state.deliveryConfig || DEFAULT_DELIVERY_FEE_CONFIG;
      const total = window.chowStore.getCartSubtotal() + config.serviceFee + fee;

      document.getElementById('cart-delivery-fee-val').innerText = formatNaira(fee);
      document.getElementById('cart-grand-total-val').innerText = formatNaira(total);
      document.getElementById('cart-pay-cta-btn').innerText = `Pay ${formatNaira(total)} & Place Order`;

      row.innerHTML = `
        <div class="dq-block">
          <span class="dq-icon">🚴</span>
          <div>
            <strong>${quote.distanceLabel} • ${quote.durationLabel}</strong>
            <span>${quote.deliveryFeeLabel} delivery from ${store.name}</span>
          </div>
          <button type="button" class="dq-change" onclick="CustomerController.changeDeliveryLocation()">Change</button>
        </div>`;
    } else {
      row.style.display = 'none';
    }
  },

  changeDeliveryLocation() {
    const cartWasOpen = document.getElementById('cart-modal').classList.contains('open');
    document.getElementById('cart-modal').classList.remove('open');
    const reopen = () => {
      if (cartWasOpen) this.openCart();
    };
    if (window.chowLocationPicker) {
      window.chowLocationPicker.open({ onConfirm: () => reopen() });
    } else {
      window.chowApp.openLocationModal();
      if (cartWasOpen) setTimeout(() => this.openCart(), 800);
    }
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
      paymentMethod,
      deliveryQuote: this.quoteCache || null,
      deliveryLocation: window.chowStore.state.selectedLocation || null
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
            <strong style="font-size: 0.95rem; color: var(--c-primary);">${formatNaira(order.total)}</strong>
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

window.CustomerController = CustomerController;
