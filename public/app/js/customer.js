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

function safeFormatNaira(amount) {
  if (typeof formatNaira === 'function') {
    try {
      return formatNaira(amount);
    } catch (e) {}
  }
  const n = Number(amount) || 0;
  return '₦' + n.toLocaleString('en-NG');
}

function safeDeliveryConfig() {
  if (window.chowStore?.state?.deliveryConfig) return window.chowStore.state.deliveryConfig;
  if (typeof DEFAULT_DELIVERY_FEE_CONFIG !== 'undefined') return DEFAULT_DELIVERY_FEE_CONFIG;
  return { baseFee: 200, ratePerMeter: 0.20, minDeliveryFee: 200, serviceFee: 400 };
}

const CustomerController = {
  activeRestaurant: null,
  activeCustomizingDish: null,
  selectedAddons: [],
  customizingQty: 1,
  isLoading: true,
  isInitialLoaded: false,
  _esc,
  safeFormatNaira,
  safeDeliveryConfig,

  setActiveCustomerTab(tabName) {
    document.querySelectorAll('.bottom-nav[data-nav-for="customer"] .bottom-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
  },

  openDiscover() {
    try {
      this.closeStoreMenu();
    } catch (e) {}
    try {
      this.closeTracking();
    } catch (e) {}
    try {
      this.closeCart();
    } catch (e) {}
    try {
      const orderHistoryModal = document.getElementById('order-history-modal');
      if (orderHistoryModal) orderHistoryModal.classList.remove('open');
      const accountModal = document.getElementById('account-modal');
      if (accountModal) accountModal.classList.remove('open');
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.remove('open');
      const signoutModal = document.getElementById('signout-confirm-modal');
      if (signoutModal) signoutModal.classList.remove('open');
      const dishModal = document.getElementById('dish-customizer-modal');
      if (dishModal) dishModal.classList.remove('open');
    } catch (e) {}

    if (window.Chow45App && typeof window.Chow45App.switchRole === 'function') {
      window.Chow45App.switchRole('customer');
    }

    const homeSec = document.getElementById('customer-home-section');
    if (homeSec) homeSec.style.display = 'block';

    const storeSec = document.getElementById('customer-store-section');
    if (storeSec) storeSec.style.display = 'none';

    this.setActiveCustomerTab('discover');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  init() {
    const hasStores = Array.isArray(window.chowStore?.state?.restaurants) && window.chowStore.state.restaurants.length > 0;
    this.isInitialLoaded = hasStores;
    this.isLoading = !hasStores;

    this.bindEvents();
    this.render();

    if (!hasStores) {
      this.fetchStoresBootstrap();
    }
  },

  async fetchStoresBootstrap() {
    try {
      const res = await fetch('/api/bootstrap');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stores) && data.stores.length > 0) {
          window.chowStore.state.restaurants = data.stores;
          window.chowStore.save();
        }
      }
    } catch (e) {
      console.warn('[customer] bootstrap fetch error:', e);
    } finally {
      this.isLoading = false;
      this.isInitialLoaded = true;
      this.render();
    }
  },

  renderLoadingState() {
    return `
      <div class="discovery-loading-container" style="padding: 24px 0 40px;">
        <div style="text-align: center; padding: 24px 16px 32px;">
          <div class="chow-loader-spinner" style="width: 44px; height: 44px; border: 3.5px solid #E2E8F0; border-top-color: #00a205; border-radius: 50%; margin: 0 auto 14px; animation: chowRotate 0.8s linear infinite;"></div>
          <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: #0F172A; margin: 0 0 6px;">
            Loading campus food spots...
          </h3>
          <p style="color: #64748B; font-size: 0.86rem; margin: 0;">
            Fetching menus from kitchens around Sagamu &amp; Ibogun
          </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          ${[1, 2, 3, 4, 5, 6].map(() => `
            <div style="background: #FFFFFF; border-radius: 18px; border: 1.5px solid #F1F5F9; overflow: hidden; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
              <div style="height: 160px; background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%); background-size: 200% 100%; animation: chowShimmer 1.5s infinite; border-radius: 14px; margin-bottom: 12px;"></div>
              <div style="height: 18px; width: 65%; background: #F1F5F9; border-radius: 6px; margin-bottom: 8px;"></div>
              <div style="height: 14px; width: 40%; background: #F8FAFC; border-radius: 6px; margin-bottom: 12px;"></div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #F1F5F9; padding-top: 10px;">
                <div style="height: 18px; width: 30%; background: #F1F5F9; border-radius: 6px;"></div>
                <div style="height: 32px; width: 80px; background: #E2E8F0; border-radius: 10px;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <style>
        @keyframes chowRotate {
          to { transform: rotate(360deg); }
        }
        @keyframes chowShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      </style>
    `;
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
        <img class="category-img" src="${cat.img}" alt="${cat.name}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 80 80\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23F1F5F9\'/%3E%3Ctext x=\'50%25\' y=\'55%25\' font-size=\'34\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3E' + encodeURIComponent(cat.icon || '🍽️') + '%3C/text%3E%3C/svg%3E';" />
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

    // Show loader if still loading or restaurants not arrived yet
    const hasStores = Array.isArray(restaurants) && restaurants.length > 0;
    if (this.isLoading || (!this.isInitialLoaded && !hasStores)) {
      container.innerHTML = this.renderLoadingState();
      return;
    }

    // Filter restaurants
    let filteredStores = [...restaurants];
    const selectedCampus = window.chowStore.state.selectedCampus || 'sagamu';

    // Strictly isolate vendors by campus
    filteredStores = filteredStores.filter(r => {
      const storeCampus = r.campus || (String(r.location || r.address || '').toLowerCase().includes('ibogun') ? 'ibogun' : 'sagamu');
      return storeCampus === selectedCampus;
    });

    if (activeCategory !== 'all') {
      filteredStores = filteredStores.filter(r => r.category === activeCategory || r.menu.some(m => m.category === activeCategory));
    }

    if (activeFilter === 'fast') {
      filteredStores = filteredStores.filter(r => r.isFast);
    } else if (activeFilter === 'budget') {
      filteredStores = filteredStores.filter(r => r.isBudget || r.menu.some(m => m.price <= 2000));
    } else if (activeFilter === 'rating') {
      filteredStores = filteredStores.filter(r => Number(r.reviewsCount || 0) > 0 && Number(r.rating || 0) >= 4.0);
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
      if (selectedCampus === 'ibogun') {
        container.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; background: white; border-radius: var(--radius-xl); border: 1.5px dashed #CBD5E1; margin: 24px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
            <div style="font-size: 2.8rem; margin-bottom: 10px;">🏫</div>
            <div style="display: inline-block; padding: 4px 12px; background: #DBEAFE; color: #1E40AF; border-radius: 999px; font-size: 0.76rem; font-weight: 700; margin-bottom: 12px;">
              Ibogun Campus · OGITECH
            </div>
            <h3 style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: #0F172A; margin-bottom: 8px;">
              No food vendors active in Ibogun Campus yet
            </h3>
            <p style="color: #64748B; font-size: 0.9rem; max-width: 460px; margin: 0 auto 24px; line-height: 1.5;">
              We are currently onboarding top student food spots and kitchens around OGITECH &amp; OOU Ibogun! Check back shortly, or switch to Sagamu Campus to see active kitchens.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button class="action-btn-primary" style="padding: 12px 24px; font-weight: 700; border-radius: 12px;" onclick="Chow45App.chooseCampusStep('sagamu')">
                Switch to Sagamu Campus 🏥
              </button>
              <a href="/vendor" class="action-btn-secondary" style="padding: 12px 24px; font-weight: 700; border-radius: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                Become an Ibogun Vendor 🍳
              </a>
            </div>
          </div>
        `;
        return;
      }

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

    const popularDishes = allDishes.filter(d => d.isPopular || (Number(d.reviewsCount || 0) > 0 && Number(d.rating || 0) >= 4.5));
    const displayPopular = popularDishes.length > 0 ? popularDishes : allDishes;
    const fastDishes = allDishes.filter(d => (d.prepTime && d.prepTime.includes('15')) || d.isFast);
    const displayFast = fastDishes.length > 0 ? fastDishes : allDishes.slice().reverse();

    container.innerHTML = `
      <!-- Section 1: Popular Near You (Food Cards with Instant + Button) -->
      <div style="margin-bottom: var(--space-32);">
        <div class="section-header">
          <div>
            <h2 class="section-title">Popular Near You</h2>
            <p style="font-size: 0.8rem; color: var(--c-text-secondary);">Most ordered dishes around ${selectedCampus === 'ibogun' ? 'Ibogun Campus' : 'Sagamu Campus'}</p>
          </div>
          <span class="section-link" onclick="CustomerController.selectCategory('all')">See all</span>
        </div>
        <div class="food-cards-grid">
          ${displayPopular.slice(0, 6).map(dish => this.renderFoodCard(dish)).join('')}
        </div>
      </div>


      <!-- Section 3: Fast Delivery (Under 25 mins) -->
      <div style="margin-bottom: var(--space-32);">
        <div class="section-header">
          <div>
            <h2 class="section-title">⚡ Fast Delivery (Under 25 min)</h2>
            <p style="font-size: 0.8rem; color: var(--c-text-secondary);">Straight to your hostel or room in minutes</p>
          </div>
        </div>
        <div class="food-cards-grid">
          ${displayFast.slice(0, 6).map(dish => this.renderFoodCard(dish)).join('')}
        </div>
      </div>
    `;
  },

  renderFoodCard(dish) {
    const favFoods = window.chowStore?.state?.userProfile?.favorites?.foods;
    const isFav = Array.isArray(favFoods) ? favFoods.includes(dish.id) : false;
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

    const dishImgSrc = (dish.img && !dish.img.includes('unsplash.com'))
      ? dish.img
      : ((dish.image && !dish.image.includes('unsplash.com')) ? dish.image : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\' viewBox=\'0 0 120 120\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23F8FAFC\'/%3E%3Ctext x=\'50%25\' y=\'55%25\' font-size=\'44\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3E%F0%9F%8D%B2%3C/text%3E%3C/svg%3E');

    return `
      <div class="food-card ${isOut ? 'is-out-of-stock' : ''}" style="${isOut ? 'opacity:0.75;' : ''}" onclick="CustomerController.handleFoodCardClick('${dish.storeId}', '${dish.id}')">
        <div class="food-card-thumb-wrap">
          <img class="food-card-thumb" src="${dishImgSrc}" alt="${dish.name}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\' viewBox=\'0 0 120 120\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23F8FAFC\'/%3E%3Ctext x=\'50%25\' y=\'55%25\' font-size=\'44\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3E%F0%9F%8D%B2%3C/text%3E%3C/svg%3E';" />
          <button class="food-fav-btn ${isFav ? 'active' : ''}" title="Save to favorites" 
                  onclick="event.stopPropagation(); CustomerController.toggleFavFood('${dish.id}')">
            ${isFav ? '❤️' : '🤍'}
          </button>
          ${statusPill}
        </div>
        <div class="food-card-body">
          <div class="food-card-name">${dish.name}</div>
          <div class="food-card-store">${dish.storeName}${Number(dish.reviewsCount || 0) > 0 && Number(dish.rating || 0) > 0 ? ` • ★ ${Number(dish.rating).toFixed(1)}` : ''}</div>
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
          <img class="store-thumb" src="${store.bannerImg || store.image || '/logo.png'}" alt="${store.name}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'160\' viewBox=\'0 0 300 160\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23E2E8F0\'/%3E%3Ctext x=\'50%25\' y=\'55%25\' font-size=\'48\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3E%F0%9F%8F%AA%3C/text%3E%3C/svg%3E';" />
          <div class="store-badge-open">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span> Open Now
          </div>
          ${store.isBudget ? `<div class="store-badge-promo">🎓 Budget Deal</div>` : ''}
        </div>
        <div class="store-content">
          <div class="store-name-row">
            <h3 class="store-title">${store.name}</h3>
            ${Number(store.reviewsCount || 0) > 0 && Number(store.rating || 0) > 0 
              ? `<span class="store-rating">★ ${Number(store.rating).toFixed(1)}</span>` 
              : `<span class="store-rating" style="background:#F1F5F9; color:#64748B;">New</span>`}
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

  async openStoreMenu(storeId) {
    let store = window.chowStore.state.restaurants.find(r => r.id === storeId);
    if (!store) {
      store = window.chowStore.state.restaurants.find(r => String(r.numericId) === String(storeId) || r.slug === storeId);
    }

    if (!store || !Array.isArray(store.menu) || store.menu.length === 0) {
      try {
        const res = await fetch('/api/bootstrap');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.stores)) {
            window.chowStore.state.restaurants = data.stores;
            window.chowStore.save();
            const fresh = data.stores.find(r => r.id === storeId || String(r.numericId) === String(storeId) || r.slug === storeId);
            if (fresh) store = fresh;
          }
        }
      } catch (err) {
        console.warn('[customer] Could not refresh store menu:', err);
      }
    }
    if (!store) return;

    this.activeRestaurant = store;
    this.activeStoreMenuFilter = 'all';
    this.storeMenuSearchQuery = '';

    const homeSec = document.getElementById('customer-home-section');
    if (homeSec) homeSec.style.display = 'none';
    const trackSec = document.getElementById('customer-tracking-section');
    if (trackSec) trackSec.style.display = 'none';
    const confSec = document.getElementById('customer-order-confirmed-section');
    if (confSec) confSec.style.display = 'none';

    const storeSection = document.getElementById('customer-store-section');
    if (storeSection) storeSection.style.display = 'block';

    const bannerEl = document.getElementById('store-detail-banner');
    if (bannerEl) {
      const bannerSrc = (store.bannerImg && !store.bannerImg.includes('unsplash.com'))
        ? store.bannerImg
        : ((store.image && !store.image.includes('unsplash.com')) ? store.image : '/logo.png');
      bannerEl.src = bannerSrc;
    }

    const badgeEl = document.getElementById('store-detail-avatar-badge');
    if (badgeEl) badgeEl.src = store.logo || store.avatar || store.image || store.bannerImg || '/logo.png';

    const nameEl = document.getElementById('store-detail-name');
    if (nameEl) nameEl.innerText = store.name;

    const tagsEl = document.getElementById('store-detail-tags');
    if (tagsEl) {
      const storeDetailTags = Array.isArray(store.tags) ? store.tags : (store.cuisine ? [store.cuisine] : ['Verified Store']);
      tagsEl.innerText = storeDetailTags.join(' • ');
    }

    const ratingEl = document.getElementById('store-detail-rating');
    if (ratingEl) {
      const hasReviews = Number(store.reviewsCount || 0) > 0 && Number(store.rating || 0) > 0;
      ratingEl.innerText = hasReviews ? `${Number(store.rating).toFixed(1)} (${store.reviewsCount} review${store.reviewsCount === 1 ? '' : 's'})` : 'New Kitchen';
    }

    const searchInput = document.getElementById('store-menu-search-input');
    if (searchInput) searchInput.value = '';

    // Render dynamic category pills based on the dishes actually available in this store
    const pillsContainer = document.getElementById('store-category-pills');
    if (pillsContainer) {
      const allDishes = Array.isArray(store.menu) ? store.menu : [];
      const cats = new Set();
      allDishes.forEach(d => {
        const c = (d.category || '').trim().toLowerCase();
        if (c && c !== 'all') cats.add(c);
      });

      let pillsHtml = `
        <button class="store-cat-pill active" data-cat="all" onclick="CustomerController.filterStoreMenuCategory('all', this)" style="padding: 7px 16px; border-radius: 999px; font-size: 0.82rem; font-weight: 700; border: none; cursor: pointer; background: #F1F5F9; color: #0F172A; white-space: nowrap;">
          All Dishes (${allDishes.length})
        </button>
      `;

      cats.forEach(c => {
        const count = allDishes.filter(d => (d.category || '').trim().toLowerCase() === c).length;
        const label = c.charAt(0).toUpperCase() + c.slice(1);
        pillsHtml += `
          <button class="store-cat-pill" data-cat="${c}" onclick="CustomerController.filterStoreMenuCategory('${c}', this)" style="padding: 7px 16px; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid #E2E8F0; background: #FFF; color: #475569; cursor: pointer; white-space: nowrap;">
            ${label} (${count})
          </button>
        `;
      });

      // If no distinct categories were found, keep default popular categories
      if (cats.size === 0) {
        ['rice', 'pasta', 'specials', 'extras'].forEach(c => {
          const label = c.charAt(0).toUpperCase() + c.slice(1);
          pillsHtml += `
            <button class="store-cat-pill" data-cat="${c}" onclick="CustomerController.filterStoreMenuCategory('${c}', this)" style="padding: 7px 16px; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid #E2E8F0; background: #FFF; color: #475569; cursor: pointer; white-space: nowrap;">
              ${label}
            </button>
          `;
        });
      }

      pillsContainer.innerHTML = pillsHtml;
    }

    this.renderStoreDishes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  filterStoreMenuCategory(catSlug, btnEl) {
    this.activeStoreMenuFilter = catSlug || 'all';
    const pills = document.querySelectorAll('#store-category-pills .store-cat-pill');
    pills.forEach(p => {
      const isTarget = btnEl ? p === btnEl : (p.getAttribute('data-cat') === this.activeStoreMenuFilter);
      p.classList.toggle('active', isTarget);
      if (isTarget) {
        p.style.background = '#F1F5F9';
        p.style.color = '#0F172A';
        p.style.border = 'none';
      } else {
        p.style.background = '#FFF';
        p.style.color = '#475569';
        p.style.border = '1px solid #E2E8F0';
      }
    });
    this.renderStoreDishes();
  },

  searchStoreMenu(q) {
    this.storeMenuSearchQuery = (q || '').toLowerCase().trim();
    this.renderStoreDishes();
  },

  renderStoreDishes() {
    const store = this.activeRestaurant;
    if (!store) return;
    const menuGrid = document.getElementById('store-dishes-grid');
    if (!menuGrid) return;

    let items = Array.isArray(store.menu) ? [...store.menu] : [];

    // Filter by category pill if not 'all'
    if (this.activeStoreMenuFilter && this.activeStoreMenuFilter !== 'all') {
      const filter = this.activeStoreMenuFilter.toLowerCase();
      items = items.filter(d => {
        const cat = (d.category || '').toLowerCase();
        const name = (d.name || '').toLowerCase();
        if (cat === filter) return true;
        if (filter === 'rice') return cat.includes('rice') || name.includes('rice') || name.includes('jollof') || name.includes('fried');
        if (filter === 'pasta') return cat.includes('pasta') || cat.includes('spag') || name.includes('pasta') || name.includes('spag') || name.includes('noodles');
        if (filter === 'specials') return cat.includes('special') || cat.includes('combo') || name.includes('max') || name.includes('special') || name.includes('refuel') || name.includes('burger');
        if (filter === 'extras') return cat.includes('extra') || cat.includes('side') || cat.includes('drink') || cat.includes('snack') || name.includes('chicken') || name.includes('dodo') || name.includes('plantain') || name.includes('salad');
        return cat.includes(filter) || name.includes(filter);
      });
    }

    // Filter by search query
    if (this.storeMenuSearchQuery) {
      const q = this.storeMenuSearchQuery;
      items = items.filter(d => 
        (d.name || '').toLowerCase().includes(q) ||
        (d.desc || '').toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q)
      );
    }

    if (items.length === 0) {
      const totalDishes = Array.isArray(store.menu) ? store.menu.length : 0;
      menuGrid.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; background: #FAF9F5; border-radius: 18px; border: 1px dashed #E2E8F0;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🍽️</div>
          <h4 style="font-weight: 800; font-size: 1rem; color: #0F172A; margin: 0 0 4px 0;">No dishes found</h4>
          <p style="font-size: 0.82rem; color: #64748B; margin: 0 0 14px 0;">Try selecting a different category or clearing your search.</p>
          ${totalDishes > 0 ? `
            <button type="button" onclick="CustomerController.filterStoreMenuCategory('all', null)" style="padding: 8px 18px; border-radius: 999px; background: var(--c-primary); color: white; border: none; font-size: 0.84rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;">
              Show All Dishes (${totalDishes})
            </button>
          ` : `
            <div style="font-size: 0.8rem; color: #94A3B8;">This store has not added dishes to its menu yet.</div>
          `}
        </div>
      `;
      return;
    }

    menuGrid.innerHTML = items.map(dish => {
      const isOut = dish.status === 'OUT_OF_STOCK' || dish.inStock === false;
      const isPreorder = Boolean(dish.preorderEnabled) && !isOut;
      const priceLabel = this._dishPriceLabel(dish);
      const displayPrice = priceLabel.startsWith('From') || priceLabel.startsWith('Starts')
        ? priceLabel
        : `Starts from ${priceLabel}`;

      return `
        <div class="store-dish-item-card ${isOut ? 'is-out-of-stock' : ''}" 
             onclick="CustomerController.handleFoodCardClick('${store.id}', '${dish.id}')"
             style="display: flex; justify-content: space-between; align-items: stretch; gap: 14px; background: #FFFFFF; border: 1.5px solid #F1F5F9; border-radius: 18px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s ease; ${isOut ? 'opacity: 0.65;' : ''}">
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h4 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 0 0 6px 0; letter-spacing: -0.01em;">${this._esc(dish.name)}</h4>
              <p style="font-size: 0.82rem; color: #64748B; margin: 0 0 10px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${this._esc(dish.desc || 'Prepared fresh with high quality ingredients and authentic Nigerian seasonings.')}
              </p>
            </div>
            <div>
              <div style="font-size: 0.92rem; font-weight: 800; color: #0F172A; margin-bottom: 2px;">
                ${displayPrice}
              </div>
              ${isOut ? '<span style="font-size:0.75rem;font-weight:700;color:#DC2626;">Out of stock</span>' : ''}
              ${isPreorder ? `<span style="font-size:0.75rem;font-weight:700;color:#92400E;">🟡 Pre-order · ${dish.preorderDate || 'Soon'}</span>` : ''}
            </div>
          </div>

          <div style="position: relative; width: 92px; height: 92px; flex-shrink: 0; border-radius: 14px; overflow: hidden; align-self: center;">
            <img src="${this._esc((dish.img && !dish.img.includes('unsplash.com')) ? dish.img : ((dish.image && !dish.image.includes('unsplash.com')) ? dish.image : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23F1F5F9\'/%3E%3Ctext x=\'50%25\' y=\'55%25\' font-size=\'38\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3E%F0%9F%8D%B2%3C/text%3E%3C/svg%3E'))}" alt="${this._esc(dish.name)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23F1F5F9\'/%3E%3Ctext x=\'50%25\' y=\'55%25\' font-size=\'38\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3E%F0%9F%8D%B2%3C/text%3E%3C/svg%3E';" />
            <button type="button" aria-label="Add ${this._esc(dish.name)}"
                    onclick="event.stopPropagation(); CustomerController.handleQuickAdd('${store.id}', '${dish.id}')"
                    ${isOut ? 'disabled style="background: #94A3B8; cursor: not-allowed;"' : ''}
                    style="position: absolute; bottom: 6px; right: 6px; width: 28px; height: 28px; border-radius: 50%; background: #0C513F; color: #FFFFFF; border: none; font-size: 1.15rem; font-weight: 900; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 3px 8px rgba(0,0,0,0.2);">
              ${isOut ? '✕' : '+'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  closeStoreMenu() {
    const storeSection = document.getElementById('customer-store-section');
    if (storeSection) storeSection.style.display = 'none';
    const homeSection = document.getElementById('customer-home-section');
    if (homeSection) homeSection.style.display = 'block';
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
    this.setActiveCustomerTab('cart');
    const modal = document.getElementById('cart-modal');
    if (!modal) return;
    modal.classList.add('open');

    try {
      const itemsList = document.getElementById('cart-items-list');

      const storeState = window.chowStore?.state || {};
      const cart = storeState.cart || { items: [] };
      const restaurants = storeState.restaurants || [];
      const selectedLocation = storeState.selectedLocation || { name: 'Campus' };
      const userProfile = storeState.userProfile || { name: '', phone: '' };

      if (!cart.items || cart.items.length === 0) {
        if (itemsList) {
          itemsList.innerHTML = `
            <div style="text-align: center; padding: 48px 16px;">
              <div style="font-size: 2.8rem; margin-bottom: 8px;">🛒</div>
              <h4 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; margin-bottom: 4px;">Your cart is waiting for something delicious</h4>
              <p style="color: var(--c-text-secondary); font-size: 0.85rem; margin-bottom: 20px;">Explore nearby kitchens and add your favorite Nigerian meals.</p>
              <button class="cta-primary-btn" onclick="CustomerController.closeCart()">Explore Food</button>
            </div>
          `;
        }
        const footer = document.getElementById('cart-checkout-footer');
        if (footer) footer.style.display = 'none';
        return;
      }

      const store = restaurants.find(r => r.id === cart.storeId);
      const config = safeDeliveryConfig();
      const subtotal = window.chowStore?.getCartSubtotal ? window.chowStore.getCartSubtotal() : (cart.items.reduce((s, i) => s + (i.itemTotal || (i.price * i.qty) || 0), 0));
      const serviceFee = config?.serviceFee ?? 400;
      const deliveryFee = typeof calculateDeliveryFee === 'function' ? calculateDeliveryFee((store && store.distanceKm ? store.distanceKm : 1.0) * 1000, config) : 200;
      const total = subtotal + serviceFee + deliveryFee;

      const storeHeaderName = document.getElementById('cart-store-header-name');
      if (storeHeaderName) storeHeaderName.innerText = cart.storeName || 'Restaurant';

      if (itemsList) {
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
                ${safeFormatNaira(item.itemTotal)}
              </div>
            </div>
            <div class="qty-control" style="padding: 3px 8px;">
              <button class="qty-btn" onclick="window.chowStore?.updateCartItemQty ? window.chowStore.updateCartItemQty(${idx}, -1) : null">−</button>
              <span class="qty-display">${item.qty}</span>
              <button class="qty-btn" onclick="window.chowStore?.updateCartItemQty ? window.chowStore.updateCartItemQty(${idx}, 1) : null">+</button>
            </div>
          </div>
        `).join('');
      }

      // Update Pricing Breakdown matching Point 21 & 56
      const subtotalEl = document.getElementById('cart-subtotal-val');
      if (subtotalEl) subtotalEl.innerText = safeFormatNaira(subtotal);
      const serviceFeeEl = document.getElementById('cart-service-fee-val');
      if (serviceFeeEl) serviceFeeEl.innerText = safeFormatNaira(serviceFee);
      const deliveryFeeEl = document.getElementById('cart-delivery-fee-val');
      if (deliveryFeeEl) deliveryFeeEl.innerText = safeFormatNaira(deliveryFee);
      const grandTotalEl = document.getElementById('cart-grand-total-val');
      if (grandTotalEl) grandTotalEl.innerText = safeFormatNaira(total);

      // Delivery destination preview
      const addrInput = document.getElementById('checkout-address-input');
      if (addrInput && !addrInput.value) {
        const candidate = selectedLocation?.formattedAddress || selectedLocation?.name || (userProfile?.savedAddresses?.[0]?.formattedAddress || userProfile?.savedAddresses?.[0]?.address) || '';
        if (candidate && candidate !== 'Campus' && !candidate.startsWith('Near OSUTH')) {
          addrInput.value = candidate;
        }
      }
      const nameInput = document.getElementById('checkout-name-input');
      if (nameInput) nameInput.value = userProfile?.name || '';
      const phoneInput = document.getElementById('checkout-phone-input');
      if (phoneInput) phoneInput.value = userProfile?.phone || '';

      const payBtn = document.getElementById('cart-pay-cta-btn');
      if (payBtn) payBtn.innerText = `Pay ${safeFormatNaira(total)} & Place Order`;

      const footer = document.getElementById('cart-checkout-footer');
      if (footer) footer.style.display = 'block';

      // Live distance-based delivery quote (Mapbox route + server-validated price)
      this.quoteCache = null;
      this.refreshDeliveryQuote(store);
    } catch (e) {
      console.warn('[customer] error updating cart modal contents:', e);
    }
  },


  /**
   * Fetch the live delivery route from the restaurant's coordinates to the
   * user's selected delivery location and reconcile the cart's delivery fee.
   */
  async refreshDeliveryQuote(store) {
    const row = document.getElementById('cart-delivery-quote');
    const state = window.chowStore.state;
    const loc = state.selectedLocation;
    const distEl = document.getElementById('cart-distance-val');
    const payBtn = document.getElementById('cart-pay-cta-btn');

    if (!row || !store) return;
    if (!loc) {
      if (distEl) distEl.innerText = 'Select location';
      row.style.display = 'block';
      row.innerHTML = `
        <div class="dq-block" style="border-left: 3px solid #f59e0b;">
          <span class="dq-icon">📍</span>
          <div><strong>Delivery location required</strong><span>Please choose your delivery address on the map</span></div>
          <button type="button" class="dq-change" onclick="CustomerController.changeDeliveryLocation()">Select</button>
        </div>`;
      return;
    }
    if (!window.chowMap || typeof window.chowMap.getDeliveryQuote !== 'function') return;

    row.style.display = 'block';
    row.innerHTML = `
      <div class="dq-block">
        <span class="dq-icon">🚴</span>
        <div><strong>Calculating live delivery…</strong><span>Using straight-line GPS distance</span></div>
      </div>`;

    let quote = null;
    try {
      quote = await window.chowMap.getDeliveryQuote(store, loc);
    } catch (e) {
      console.warn('Delivery quote failed:', e);
    }

    if (quote && quote.error) {
      this.quoteCache = quote;
      row.innerHTML = `
        <div class="dq-block" style="border-left: 3px solid #e11d48;">
          <span class="dq-icon">⚠️</span>
          <div><strong style="color: #e11d48;">Location Issue</strong><span>${quote.error}</span></div>
          <button type="button" class="dq-change" onclick="CustomerController.changeDeliveryLocation()">Select Pin</button>
        </div>`;
      if (distEl) distEl.innerText = 'Unavailable';
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.style.opacity = '0.5';
        payBtn.style.cursor = 'not-allowed';
        payBtn.innerText = 'Location Required to Checkout';
      }
      return;
    }

    if (quote && typeof quote.deliveryFee === 'number') {
      this.quoteCache = quote;
      const fee = quote.deliveryFee;
      const config = typeof safeDeliveryConfig === 'function' ? safeDeliveryConfig() : {};
      const total = window.chowStore.getCartSubtotal() + (config?.serviceFee ?? 400) + fee;

      if (distEl && quote.distanceLabel) {
        distEl.innerText = quote.distanceLabel;
      }
      const delFeeEl = document.getElementById('cart-delivery-fee-val');
      if (delFeeEl) delFeeEl.innerText = safeFormatNaira(fee);
      const grandTotalEl = document.getElementById('cart-grand-total-val');
      if (grandTotalEl) grandTotalEl.innerText = safeFormatNaira(total);
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.style.opacity = '1';
        payBtn.style.cursor = 'pointer';
        payBtn.innerText = `Pay ${safeFormatNaira(total)} & Place Order`;
      }

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

  onDeliveryAddressChanged(val) {
    const errorEl = document.getElementById('checkout-address-error');
    const input = document.getElementById('checkout-address-input');
    const cleanVal = String(val || '').trim();
    if (cleanVal.length > 0) {
      if (errorEl) errorEl.style.display = 'none';
      if (input) input.style.borderColor = '';
    }
    if (window.chowStore?.state) {
      if (!window.chowStore.state.selectedLocation) {
        window.chowStore.state.selectedLocation = {
          name: cleanVal,
          formattedAddress: cleanVal,
          lat: 6.8400,
          lng: 3.6500
        };
      } else {
        window.chowStore.state.selectedLocation.name = cleanVal;
        window.chowStore.state.selectedLocation.formattedAddress = cleanVal;
      }
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
    const modal = document.getElementById('cart-modal');
    if (modal) modal.classList.remove('open');
    this.setActiveCustomerTab('discover');
  },

  async placeOrder() {
    const { cart } = window.chowStore.state;
    if (cart.items.length === 0) return;

    const deliveryAddressInput = document.getElementById('checkout-address-input');
    const deliveryAddress = (deliveryAddressInput ? deliveryAddressInput.value : '').trim();
    const errorBanner = document.getElementById('checkout-address-error');

    if (!deliveryAddress) {
      if (errorBanner) {
        errorBanner.style.display = 'flex';
      }
      if (deliveryAddressInput) {
        deliveryAddressInput.style.borderColor = '#E11D48';
        deliveryAddressInput.focus();
      }
      if (window.chowApp && typeof window.chowApp.toast === 'function') {
        window.chowApp.toast('Please input your delivery address to place your order.', 'error');
      } else if (window.chowApp && typeof window.chowApp.showToast === 'function') {
        window.chowApp.showToast('Please input your delivery address to place your order.', 'error');
      }
      return;
    }

    // Validate customer delivery coordinates
    const selectedLoc = window.chowStore.state.selectedLocation;
    const custLat = selectedLoc ? Number(selectedLoc.latitude ?? selectedLoc.lat) : NaN;
    const custLng = selectedLoc ? Number(selectedLoc.longitude ?? selectedLoc.lng) : NaN;

    if (!Number.isFinite(custLat) || !Number.isFinite(custLng) || custLat < -90 || custLat > 90 || custLng < -180 || custLng > 180) {
      if (window.chowApp && typeof window.chowApp.toast === 'function') {
        window.chowApp.toast('Please select a valid delivery location pin on the map.', 'error');
      }
      this.changeDeliveryLocation();
      return;
    }

    if (this.quoteCache && this.quoteCache.error) {
      if (window.chowApp && typeof window.chowApp.toast === 'function') {
        window.chowApp.toast(this.quoteCache.error, 'error');
      }
      return;
    }

    const customerName = document.getElementById('checkout-name-input').value.trim() || 'Precious M.';
    const customerPhone = document.getElementById('checkout-phone-input').value.trim() || (window.chowStore?.state?.userProfile?.phone || '');
    const deliveryNotes = document.getElementById('checkout-notes-input').value.trim();
    const paymentMethod = document.getElementById('checkout-payment-method').value;

    const payBtn = document.getElementById('cart-pay-cta-btn');
    const origBtnText = payBtn ? payBtn.innerText : '';
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerText = 'Placing Order & Verifying...';
    }

    // 1. Create order initially with PENDING_PAYMENT
    const newOrder = window.chowStore.createOrder({
      storeId: cart.storeId,
      storeName: cart.storeName,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      status: 'PENDING_PAYMENT',
      deliveryQuote: this.quoteCache || null,
      deliveryLocation: window.chowStore.state.selectedLocation || null
    });

    // 2. Persist order to database and verify payment in one shot
    const payRef = 'PAY_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    try {
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: newOrder.id,
          reference: payRef,
          amount: newOrder.total,
          // Pass full order so the server can persist it to PostgreSQL
          // (riders query the DB — they cannot see localStorage orders)
          order: {
            id: newOrder.id,
            storeId: newOrder.storeId,
            storeName: newOrder.storeName,
            customerName: newOrder.customerName,
            customerPhone: newOrder.customerPhone,
            deliveryAddress: newOrder.deliveryAddress,
            deliveryNotes: newOrder.deliveryNotes,
            deliveryLocation: newOrder.deliveryLocation || null,
            paymentMethod: newOrder.paymentMethod,
            subtotal: newOrder.subtotal,
            serviceFee: newOrder.serviceFee,
            deliveryFee: newOrder.deliveryFee,
            total: newOrder.total,
            pin: newOrder.pin,
            routeDistanceMeters: newOrder.routeDistanceMeters || null,
            estimatedDurationSeconds: newOrder.estimatedDurationSeconds || null,
            isPreorder: Boolean(newOrder.isPreorder),
            preorderReadyDate: newOrder.preorderReadyDate || null,
            preorderReadyTime: newOrder.preorderReadyTime || null,
            isFoodReady: Boolean(newOrder.isFoodReady),
            items: newOrder.items || [],
            status: 'PENDING_PAYMENT'
          }
        })
      });

      const verifyData = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok || verifyData.error) {
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.innerText = origBtnText;
        }
        const errMsg = verifyData.error || 'Failed to place order. Please try again.';
        if (window.chowApp && typeof window.chowApp.toast === 'function') {
          window.chowApp.toast(errMsg, 'error');
        } else if (window.chowApp && typeof window.chowApp.showToast === 'function') {
          window.chowApp.showToast(errMsg, 'error');
        }
        return;
      }

      window.chowStore.advanceOrderStatus(newOrder.id, 'PAID');
    } catch (e) {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerText = origBtnText;
      }
      console.error('Checkout error:', e);
      if (window.chowApp && typeof window.chowApp.toast === 'function') {
        window.chowApp.toast('Network error during checkout. Please check your connection.', 'error');
      }
      return;
    }

    this.closeCart();

    // 3. Populate and show Order Confirmed screen (matches media_1790893923594.png)
    this.lastConfirmedOrderId = newOrder.id;
    const basePts = 0.5;
    const bonusPts = 0.2;
    const totalPts = 0.7;

    const ptsPill = document.getElementById('confirmed-points-pill');
    if (ptsPill) ptsPill.innerText = `+${totalPts} points`;
    const ptsBase = document.getElementById('confirmed-points-base');
    if (ptsBase) ptsBase.innerText = `+ ${basePts} pts`;
    const ptsBonus = document.getElementById('confirmed-points-bonus');
    if (ptsBonus) ptsBonus.innerText = `+ ${bonusPts} pts`;
    const ptsTotal = document.getElementById('confirmed-points-total');
    if (ptsTotal) ptsTotal.innerText = `+ ${totalPts} pts`;

    // Hide other views, display Order Confirmed screen
    const homeSec = document.getElementById('customer-home-section');
    if (homeSec) homeSec.style.display = 'none';
    const storeSec = document.getElementById('customer-store-section');
    if (storeSec) storeSec.style.display = 'none';
    const trackSec = document.getElementById('customer-tracking-section');
    if (trackSec) trackSec.style.display = 'none';

    const confirmedSec = document.getElementById('customer-order-confirmed-section');
    if (confirmedSec) {
      confirmedSec.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.chowApp.toast('Payment verified! Order sent to kitchen ✓', 'success');
  },

  trackConfirmedOrder() {
    const confirmedSec = document.getElementById('customer-order-confirmed-section');
    if (confirmedSec) confirmedSec.style.display = 'none';
    if (this.lastConfirmedOrderId) {
      this.openOrderTracking(this.lastConfirmedOrderId);
    }
  },

  // -------------------------------------------------------------
  // Live Mapbox Order Tracking View (Matches media_1790893892975.png)
  // -------------------------------------------------------------
  async openOrderTracking(orderId) {
    let order = window.chowStore.state.orders.find(o => o.id === orderId);
    if (!order) {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.order) {
            order = data.order;
            window.chowStore.state.orders.unshift(order);
            window.chowStore.save();
          }
        }
      } catch (e) {}
    }
    if (!order) {
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('Order details not found.', 'warning');
      }
      return;
    }

    this.activeTrackingOrderId = orderId;
    const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId) || window.chowStore.state.restaurants[0];
    const location = window.chowStore.state.selectedLocation;

    const homeSec = document.getElementById('customer-home-section');
    if (homeSec) homeSec.style.display = 'none';
    const storeSec = document.getElementById('customer-store-section');
    if (storeSec) storeSec.style.display = 'none';
    const confirmedSec = document.getElementById('customer-order-confirmed-section');
    if (confirmedSec) confirmedSec.style.display = 'none';

    const trackSection = document.getElementById('customer-tracking-section');
    trackSection.style.display = 'block';

    const orderNumEl = document.getElementById('track-order-num');
    if (orderNumEl) {
      orderNumEl.innerText = order.pin ? `CH${order.pin}` : (order.id.slice(0, 6).toUpperCase());
    }

    const pinEl = document.getElementById('track-order-pin');
    if (pinEl) pinEl.innerText = order.pin || '4528';

    const storeNameEl = document.getElementById('track-store-name');
    if (storeNameEl) storeNameEl.innerText = order.storeName;

    const destAddrEl = document.getElementById('track-dest-address');
    if (destAddrEl) destAddrEl.innerText = order.deliveryAddress;

    const noteDisplay = document.getElementById('track-order-note-display');
    if (noteDisplay) {
      noteDisplay.innerText = order.deliveryNotes ? `Note: ${order.deliveryNotes}` : 'Add Order Note';
    }

    // Pre-order Live Banner
    const preBanner = document.getElementById('track-preorder-banner');
    const preDateEl = document.getElementById('track-preorder-date');
    const preTimeEl = document.getElementById('track-preorder-time');
    const preReadyBadge = document.getElementById('track-preorder-readiness-badge');
    if (preBanner && preDateEl && preTimeEl && preReadyBadge) {
      if (order.isPreorder) {
        preBanner.style.display = 'block';
        preDateEl.innerText = order.preorderReadyDate || 'Scheduled date pending';
        preTimeEl.innerText = order.preorderReadyTime || 'Scheduled time pending';
        if (order.isFoodReady) {
          preReadyBadge.innerText = '✅ Food Ready for Delivery';
          preReadyBadge.style.background = '#DCFCE7';
          preReadyBadge.style.color = '#15803D';
          preReadyBadge.style.border = '1px solid #86EFAC';
        } else {
          preReadyBadge.innerText = '⏳ Kitchen Preparing';
          preReadyBadge.style.background = '#FEF3C7';
          preReadyBadge.style.color = '#B45309';
          preReadyBadge.style.border = '1px solid #FDE68A';
        }
      } else {
        preBanner.style.display = 'none';
      }
    }

    // Rider Dispatch Profile (STRICT: Never show demo/fake rider when order has no assigned rider)
    const hasAssignedRider = Boolean(order.riderId);
    const rider = hasAssignedRider ? (window.chowStore.state.riders || []).find(r => r.id === order.riderId) : null;
    const riderNameEl = document.getElementById('track-rider-name');
    const riderSubtextEl = document.getElementById('track-rider-subtext');
    const callBtn = document.getElementById('track-rider-call-btn');
    const waBtn = document.getElementById('track-rider-wa-btn');

    const realRiderName = hasAssignedRider ? ((rider && rider.name) || order.riderName) : null;
    const realRiderPhone = hasAssignedRider ? ((rider && rider.phone) || order.riderPhone) : null;
    const realRiderVehicle = hasAssignedRider ? ((rider && rider.vehicle) || order.riderVehicle) : null;

    if (realRiderName) {
      if (riderNameEl) riderNameEl.innerText = realRiderName;
      if (riderSubtextEl) riderSubtextEl.innerText = realRiderVehicle || 'Assigned Dispatch Rider';
      if (realRiderPhone) {
        if (callBtn) {
          callBtn.href = `tel:${realRiderPhone}`;
          callBtn.style.display = 'inline-flex';
        }
        if (waBtn) {
          waBtn.href = `https://wa.me/${realRiderPhone.replace(/\D/g, '')}`;
          waBtn.style.display = 'inline-flex';
        }
      } else {
        if (callBtn) callBtn.style.display = 'none';
        if (waBtn) waBtn.style.display = 'none';
      }
    } else {
      if (riderNameEl) riderNameEl.innerText = 'Assigning dispatch rider...';
      if (riderSubtextEl) {
        riderSubtextEl.innerText = order.isPreorder
          ? 'Pre-order confirmed · Rider will be assigned closer to delivery time'
          : 'Kitchen is preparing your meal · Searching for nearby dispatch rider';
      }
      if (callBtn) callBtn.style.display = 'none';
      if (waBtn) waBtn.style.display = 'none';
    }

    this.updateTrackingStatusUI(order);

    if (window.chowMap && typeof window.chowMap.renderDeliveryMission === 'function') {
      window.chowMap.renderDeliveryMission(order, store, location);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Start live tracking poll to detect when rider enters code and completes delivery
    this.startTrackingPoll(orderId);
  },

  startTrackingPoll(orderId) {
    if (this._trackingPollInterval) {
      clearInterval(this._trackingPollInterval);
      this._trackingPollInterval = null;
    }

    const poll = async () => {
      if (!orderId) return;
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.order && data.order.status) {
          const currentOrder = window.chowStore.state.orders.find(o => o.id === orderId);
          const wasDelivered = currentOrder && currentOrder.status === 'DELIVERED';

          if (currentOrder && currentOrder.status !== data.order.status) {
            window.chowStore.advanceOrderStatus(orderId, data.order.status, {
              riderId: data.order.riderId,
              riderName: data.order.riderName
            });
            this.updateTrackingStatusUI(data.order);
          }

          // Immediately when code is given to rider and verified, order is complete:
          if (data.order.status === 'DELIVERED') {
            this.stopTrackingPoll();

            if (!wasDelivered) {
              // Award 0.7 points to customer profile
              if (window.chowStore && window.chowStore.state) {
                if (!window.chowStore.state.userProfile) window.chowStore.state.userProfile = {};
                const currentPts = Number(window.chowStore.state.userProfile.points || 0);
                window.chowStore.state.userProfile.points = parseFloat((currentPts + 0.7).toFixed(1));
                window.chowStore.save();
              }

              if (window.chowApp && window.chowApp.toast) {
                window.chowApp.toast('🎉 Order completed! +0.7 points awarded to your account.', 'success');
              }
            }
          }
        }

        // Live Rider GPS Tracking: update live marker on Google Map & rider profile
        try {
          const trackRes = await fetch(`/api/orders/${orderId}/track`);
          if (trackRes.ok) {
            const trackData = await trackRes.json();
            // Live Pre-Order schedule & food readiness update
            if (trackData && trackData.isPreorder) {
              const preBanner = document.getElementById('track-preorder-banner');
              const preDateEl = document.getElementById('track-preorder-date');
              const preTimeEl = document.getElementById('track-preorder-time');
              const preReadyBadge = document.getElementById('track-preorder-readiness-badge');
              if (preBanner && preDateEl && preTimeEl && preReadyBadge) {
                preBanner.style.display = 'block';
                if (trackData.preorderReadyDate) preDateEl.innerText = trackData.preorderReadyDate;
                if (trackData.preorderReadyTime) preTimeEl.innerText = trackData.preorderReadyTime;
                if (trackData.isFoodReady) {
                  preReadyBadge.innerText = '✅ Food Ready for Delivery';
                  preReadyBadge.style.background = '#DCFCE7';
                  preReadyBadge.style.color = '#15803D';
                  preReadyBadge.style.border = '1px solid #86EFAC';
                } else {
                  preReadyBadge.innerText = '⏳ Kitchen Preparing';
                  preReadyBadge.style.background = '#FEF3C7';
                  preReadyBadge.style.color = '#B45309';
                  preReadyBadge.style.border = '1px solid #FDE68A';
                }
              }
            }

            // Live Rider Dispatch Profile: strictly real assigned rider ONLY
            const rNameEl = document.getElementById('track-rider-name');
            const rSubtextEl = document.getElementById('track-rider-subtext');
            const cBtn = document.getElementById('track-rider-call-btn');
            const wBtn = document.getElementById('track-rider-wa-btn');

            if (trackData && trackData.riderId && trackData.riderName) {
              if (rNameEl) rNameEl.innerText = trackData.riderName;
              if (rSubtextEl) rSubtextEl.innerText = trackData.riderVehicle || 'Assigned Dispatch Rider';
              if (trackData.riderPhone) {
                if (cBtn) {
                  cBtn.href = `tel:${trackData.riderPhone}`;
                  cBtn.style.display = 'inline-flex';
                }
                if (wBtn) {
                  wBtn.href = `https://wa.me/${trackData.riderPhone.replace(/\D/g, '')}`;
                  wBtn.style.display = 'inline-flex';
                }
              }
              if (Number.isFinite(trackData.riderLat) && Number.isFinite(trackData.riderLng)) {
                if (window.chowMap && typeof window.chowMap.updateRiderPosition === 'function') {
                  window.chowMap.updateRiderPosition(trackData.riderLng, trackData.riderLat, trackData.riderName);
                }
              }
            } else {
              if (rNameEl) rNameEl.innerText = 'Assigning dispatch rider...';
              if (rSubtextEl) {
                rSubtextEl.innerText = (trackData && trackData.isPreorder)
                  ? 'Pre-order confirmed · Rider will be assigned closer to delivery time'
                  : 'Kitchen is preparing your meal · Searching for nearby dispatch rider';
              }
              if (cBtn) cBtn.style.display = 'none';
              if (wBtn) wBtn.style.display = 'none';
            }
          }
        } catch (tErr) {
          // ignore tracking poll network blip
        }
      } catch (err) {
        // silent
      }
    };

    poll();
    this._trackingPollInterval = setInterval(poll, 2500);
  },

  stopTrackingPoll() {
    if (this._trackingPollInterval) {
      clearInterval(this._trackingPollInterval);
      this._trackingPollInterval = null;
    }
  },

  updateTrackingStatusUI(order) {
    const status = order.status;
    let stepIndex = 1;
    let heading = 'Order Confirmed';
    let subtext = 'Your order is being processed';

    if (status === 'PENDING_PAYMENT') {
      stepIndex = 1;
      heading = 'Payment Confirmation';
      subtext = 'Authorizing payment with bank';
    } else if (status === 'PAID') {
      stepIndex = 1;
      heading = 'Order Confirmed';
      subtext = 'Sent to restaurant kitchen';
    } else if (status === 'RESTAURANT_ACCEPTED') {
      stepIndex = 1;
      heading = 'Restaurant Accepted';
      subtext = 'Chef received and accepted your order';
    } else if (status === 'PREPARING') {
      stepIndex = 1;
      heading = 'Preparing Food';
      subtext = 'Chefs are cooking and packaging fresh';
    } else if (status === 'RIDER_ASSIGNED' || status === 'RIDER_HEADING_TO_STORE') {
      stepIndex = 1;
      heading = 'Rider on the way to the store';
      subtext = 'Assigned rider is heading to the restaurant';
    } else if (status === 'READY_FOR_PICKUP' || status === 'RIDER_AT_STORE') {
      stepIndex = 2;
      heading = 'Rider at the store';
      subtext = 'Rider has arrived at the store collecting your meal';
    } else if (status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY') {
      stepIndex = 3;
      heading = 'Rider on the way to your location';
      subtext = 'Your meal is packaged and en route to your location';
    } else if (status === 'RIDER_NEARBY') {
      stepIndex = 4;
      heading = 'Rider at your location';
      subtext = 'Rider has arrived! Share your 4-digit PIN to collect';
    } else if (status === 'DELIVERED') {
      stepIndex = 5;
      heading = 'Order successful';
      subtext = 'Delivered and verified with security PIN';
    }

    const headingEl = document.getElementById('track-status-heading');
    if (headingEl) headingEl.innerText = heading;

    const subtextEl = document.getElementById('track-status-subtext');
    if (subtextEl) subtextEl.innerText = subtext;

    // 5-Segment Stepper
    const segments = document.querySelectorAll('.tracking-stepper .stepper-segment');
    segments.forEach((seg, idx) => {
      seg.className = 'stepper-segment';
      if (idx < stepIndex) {
        seg.style.background = '#22C55E';
      } else {
        seg.style.background = '#E2E8F0';
      }
    });

    const etaBadge = document.getElementById('track-eta-badge');
    if (etaBadge) {
      etaBadge.innerText = status === 'DELIVERED' ? 'Delivered' : (stepIndex >= 4 ? 'Est: 8 mins away' : 'Est: 25 mins');
    }
  },

  // -------------------------------------------------------------
  // Order Timeline Modal (Matches media_1790893952397.png)
  // -------------------------------------------------------------
  openTimelineModal() {
    const orderId = this.activeTrackingOrderId || (window.chowStore.state.orders[0]?.id);
    const order = window.chowStore.state.orders.find(o => o.id === orderId);
    if (!order) return;

    const status = order.status;
    const isStep1 = true;
    const isStep2 = !['PENDING_PAYMENT'].includes(status);
    const isStep3 = ['PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_HEADING_TO_STORE', 'RIDER_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'RIDER_NEARBY', 'DELIVERED'].includes(status);
    const isStep4 = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'RIDER_NEARBY', 'DELIVERED'].includes(status);
    const isStep5 = status === 'DELIVERED';

    const orderTime = new Date(order.createdAt || Date.now());
    const formatT = (offsetMin) => {
      const d = new Date(orderTime.getTime() + offsetMin * 60000);
      return `Today, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const timelineHeading = document.getElementById('timeline-status-heading');
    if (timelineHeading) {
      timelineHeading.innerText = isStep5 ? 'Order Completed' : (isStep4 ? 'Order In Transit' : (isStep3 ? 'Preparing Order' : 'Order Confirmed'));
    }

    const container = document.getElementById('timeline-events-container');
    if (container) {
      const steps = [
        {
          title: 'Payment Confirmation',
          desc: 'Payment for your order has been received and confirmed',
          time: formatT(0),
          done: isStep1
        },
        {
          title: 'Payment Received',
          desc: 'Order sent to restaurant and kitchen confirmed',
          time: formatT(1),
          done: isStep2
        },
        {
          title: 'Preparing your Order',
          desc: 'Your order is being prepared and packed with care',
          time: formatT(4),
          done: isStep3
        },
        {
          title: 'Order in Transit',
          desc: 'Rider has picked up your order and is heading your way',
          time: formatT(12),
          done: isStep4
        },
        {
          title: 'Order Completed',
          desc: '4-digit PIN verified by rider and meal delivered',
          time: isStep5 ? formatT(22) : 'Estimated soon',
          done: isStep5
        }
      ];

      container.innerHTML = steps.map((s, idx) => {
        const isLast = idx === steps.length - 1;
        const checkBg = s.done ? '#16A34A' : '#E2E8F0';
        const checkColor = s.done ? '#FFFFFF' : '#94A3B8';
        const titleColor = s.done ? '#0F172A' : '#94A3B8';
        const lineColor = s.done && !isLast ? '#22C55E' : '#E2E8F0';

        return `
          <div style="display: flex; gap: 14px; position: relative;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 26px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: ${checkBg}; color: ${checkColor}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; z-index: 2;">
                ${s.done ? '✓' : ''}
              </div>
              ${!isLast ? `<div style="width: 2px; flex: 1; background: ${lineColor}; min-height: 48px; margin: 4px 0;"></div>` : ''}
            </div>
            <div style="flex: 1; padding-bottom: ${isLast ? '0' : '20px'};">
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                <h4 style="font-size: 0.95rem; font-weight: 800; color: ${titleColor}; margin: 0 0 2px 0;">${s.title}</h4>
                <span style="font-size: 0.72rem; color: #94A3B8; font-weight: 600; white-space: nowrap;">${s.time}</span>
              </div>
              <p style="font-size: 0.8rem; color: #64748B; margin: 0; line-height: 1.4;">${s.desc}</p>
            </div>
          </div>
        `;
      }).join('');
    }

    const modal = document.getElementById('order-timeline-modal');
    if (modal) modal.classList.add('open');
  },

  closeTimelineModal() {
    const modal = document.getElementById('order-timeline-modal');
    if (modal) modal.classList.remove('open');
  },

  closeTracking() {
    this.stopTrackingPoll();
    const trackSec = document.getElementById('customer-tracking-section');
    if (trackSec) trackSec.style.display = 'none';
    const confirmedSec = document.getElementById('customer-order-confirmed-section');
    if (confirmedSec) confirmedSec.style.display = 'none';
    const storeSec = document.getElementById('customer-store-section');
    if (storeSec) storeSec.style.display = 'none';
    document.getElementById('customer-home-section').style.display = 'block';
    if (window.chowMap) window.chowMap.clearMarkers();
  },

  // -------------------------------------------------------------
  // Order History & Reviews
  // -------------------------------------------------------------
  openOrderHistory() {
    this.setActiveCustomerTab('orders');
    const modal = document.getElementById('order-history-modal');
    if (!modal) return;
    modal.classList.add('open');

    const renderList = (orders) => {
      const container = document.getElementById('order-history-list');
      if (!container) return;
      if (!orders || orders.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px;">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">📦</div>
            <p style="font-weight: 700; color: #1E293B;">You haven't placed an order yet.</p>
            <p style="font-size: 0.85rem; color: #64748B; margin-top: 4px;">Hungry? Discover dishes from popular campus kitchens.</p>
            <button class="cta-primary-btn" style="margin-top: 14px;" onclick="CustomerController.closeOrderHistory()">Find Food</button>
          </div>
        `;
      } else {
        container.innerHTML = orders.map(order => `
          <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div>
                <strong style="font-size: 1rem; color: #0F172A;">${order.storeName || 'Restaurant'}</strong>
                <div style="font-size: 0.78rem; color: #64748B;">#${order.id} • ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</div>
              </div>
              <span class="table-status-tag" style="background: ${order.status === 'DELIVERED' ? '#DCFCE7' : '#FEF3C7'}; color: ${order.status === 'DELIVERED' ? '#15803D' : '#B45309'}; font-weight: 800;">
                ${(typeof ORDER_STAGES !== 'undefined' && ORDER_STAGES[order.status]?.label) || order.status}
              </span>
            </div>

            <div style="font-size: 0.85rem; color: #334155; margin-bottom: 10px;">
              ${Array.isArray(order.items) ? order.items.map(i => `${i.qty}x ${i.name}`).join(', ') : ''}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E2E8F0; padding-top: 10px;">
              <strong style="font-size: 0.95rem; color: var(--c-primary, #008751);">${safeFormatNaira(order.total || 0)}</strong>
              <div style="display: flex; gap: 8px;">
                ${order.status === 'DELIVERED' ? `
                  <button class="action-btn-secondary" style="padding: 5px 12px; font-size: 0.75rem; border-radius: 8px;" onclick="CustomerController.openReviewModal('${order.id}')">Rate Order</button>
                  <button class="action-btn-primary" style="padding: 5px 14px; font-size: 0.75rem; border-radius: 8px;" onclick="CustomerController.reorder('${order.id}')">Reorder</button>
                ` : `
                  <button class="action-btn-primary" style="padding: 5px 14px; font-size: 0.75rem; border-radius: 8px;" onclick="CustomerController.openOrderTracking('${order.id}'); CustomerController.closeOrderHistory();">Track Live ➔</button>
                `}
              </div>
            </div>
          </div>
        `).join('');
      }
    };

    try {
      const localOrders = window.chowStore?.state?.orders || [];
      renderList(localOrders);

      // Reconcile with real database orders
      fetch('/api/orders', { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && Array.isArray(data.orders)) {
            const serverOrders = data.orders;
            if (serverOrders.length > 0) {
              const mergedMap = new Map();
              // Server orders are authoritative
              serverOrders.forEach(o => mergedMap.set(o.id, o));
              // Keep any local unpersisted orders if any
              localOrders.forEach(o => {
                if (!mergedMap.has(o.id)) mergedMap.set(o.id, o);
              });
              const mergedList = Array.from(mergedMap.values());
              if (window.chowStore && window.chowStore.state) {
                window.chowStore.state.orders = mergedList;
                window.chowStore.save();
              }
              renderList(mergedList);
            } else if (localOrders.length === 0) {
              renderList([]);
            }
          }
        })
        .catch(() => {});
    } catch (e) {
      console.warn('[customer] error updating order history list:', e);
    }
  },

  closeOrderHistory() {
    const modal = document.getElementById('order-history-modal');
    if (modal) modal.classList.remove('open');
    this.setActiveCustomerTab('discover');
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
