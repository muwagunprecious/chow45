/**
 * CHOW45 UNIFIED REACTIVE STATE ENGINE
 * Synchronizes state across all 4 roles: Customer, Vendor, Rider, and Admin
 * Persisted in localStorage with cross-role event dispatching.
 */

const ORDER_STAGES = {
  PENDING_PAYMENT: { key: 'PENDING_PAYMENT', label: 'Payment Pending', humanText: 'Awaiting payment confirmation', stepIndex: 0 },
  PAID: { key: 'PAID', label: 'Order Confirmed', humanText: 'Payment successful! Sent to restaurant', stepIndex: 1 },
  RESTAURANT_ACCEPTED: { key: 'RESTAURANT_ACCEPTED', label: 'Restaurant Accepted', humanText: 'Restaurant accepted your order', stepIndex: 2 },
  PREPARING: { key: 'PREPARING', label: 'Preparing Food', humanText: 'Your food is being prepared', stepIndex: 3 },
  READY_FOR_PICKUP: { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', humanText: 'Your food is packaged and waiting for the rider', stepIndex: 4 },
  RIDER_ASSIGNED: { key: 'RIDER_ASSIGNED', label: 'Rider Assigned', humanText: 'David has accepted your delivery', stepIndex: 5 },
  RIDER_HEADING_TO_STORE: { key: 'RIDER_HEADING_TO_STORE', label: 'Rider Heading to Store', humanText: 'Your rider is heading to the restaurant', stepIndex: 6 },
  RIDER_AT_STORE: { key: 'RIDER_AT_STORE', label: 'Rider at Store', humanText: 'Your rider is at the restaurant', stepIndex: 7 },
  PICKED_UP: { key: 'PICKED_UP', label: 'Order Picked Up', humanText: 'Your food has been picked up', stepIndex: 8 },
  OUT_FOR_DELIVERY: { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', humanText: 'Rider is on the way to your delivery address', stepIndex: 9 },
  RIDER_NEARBY: { key: 'RIDER_NEARBY', label: 'Rider Nearby', humanText: 'David is 8 minutes away', stepIndex: 10 },
  DELIVERED: { key: 'DELIVERED', label: 'Delivered', humanText: 'Your food has been delivered! Enjoy your meal.', stepIndex: 11 },
  REJECTED: { key: 'REJECTED', label: 'Cancelled by Restaurant', humanText: 'The restaurant could not accept this order', stepIndex: 0 }
};

class Chow45Store {
  constructor() {
    this.STORAGE_KEY = 'chow45_marketplace_state_v2';
    this.listeners = [];
    this.state = this.loadInitialState();
  }

  loadInitialState() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.restaurants && parsed.restaurants.length > 0 && parsed.userProfile) {
          // Reconcile newer fields onto older saved states.
          if (!parsed.deliveryConfig) parsed.deliveryConfig = Object.assign({}, DEFAULT_DELIVERY_FEE_CONFIG);
          if (!parsed.vendorOnboarding || parsed.vendorOnboarding.storeId === 'rest-mama-t') {
            parsed.vendorOnboarding = { status: 'none', storeId: null, applicationId: null, storeName: null, appliedAt: null, approvedAt: null };
          }
          if (Array.isArray(parsed.orders)) {
            parsed.orders = parsed.orders.filter(o => o.storeId !== 'rest-mama-t' && o.id !== 'CH45281');
          }
          if (Array.isArray(parsed.pendingVendors)) {
            parsed.pendingVendors = parsed.pendingVendors.filter(v => v.id !== 'pv-101' && !String(v.name || '').includes('Iya Moria'));
          }
          if (!parsed.vendorWithdrawals) parsed.vendorWithdrawals = [];
          if (parsed.userProfile && Array.isArray(parsed.userProfile.savedAddresses)) {
            parsed.userProfile.savedAddresses = parsed.userProfile.savedAddresses.filter(a =>
              a.address !== 'OOU Main Campus Gate, Ago-Iwoye' &&
              a.address !== 'Ago-Iwoye Town, Back of OOU Hostel' &&
              a.address !== 'Sagamu Campus, OOU Ijagun' &&
              a.formattedAddress !== 'OOU Main Campus Gate, Ago-Iwoye, Ogun State, Nigeria' &&
              a.formattedAddress !== 'Ago-Iwoye Town, Ijebu North LGA, Ogun State, Nigeria' &&
              a.formattedAddress !== 'Sagamu Campus, OOU Ijagun, Ogun State, Nigeria'
            );
          }
          if (!parsed.selectedLocation) {
            parsed.selectedLocation = {
              id: 'oou-main',
              name: 'OOU Main Campus Gate, Ago-Iwoye',
              label: 'Campus',
              latitude: 6.8482,
              longitude: 3.6545,
              lat: 6.8482,
              lng: 3.6545,
              locality: 'Ago-Iwoye',
              lga: 'Ijebu North LGA',
              state: 'Ogun',
              formattedAddress: 'OOU Main Campus Gate, Ago-Iwoye, Ogun State, Nigeria',
              zoneId: 'ago-iwoye',
              zoneName: 'Ago-Iwoye (OOU Main Campus)',
              deliveryInstructions: ''
            };
          }

          // Purge demo restaurants from cached localStorage so /app only shows real vendor foods
          parsed.restaurants = (parsed.restaurants || []).filter(r =>
            r.id !== 'rest-iya-moria' &&
            r.id !== 'rest-mama-t' &&
            r.id !== 'rest-suya-hub' &&
            r.id !== 'rest-bukka-hut' &&
            r.id !== 'rest-tastee-shawarma' &&
            r.id !== 'rest-campus-pocket' &&
            !String(r.id || '').startsWith('demo-')
          );

          // Reconcile dish pricing models and extras, and ensure tags are always an array
          (parsed.restaurants || []).forEach(store => {
            if (!Array.isArray(store.tags)) {
              store.tags = store.tags ? [String(store.tags)] : (store.cuisine ? [store.cuisine] : ['Verified Store']);
            }
            (store.menu || []).forEach(dish => {
              if (!dish.priceType) dish.priceType = 'BOTH';
              if (dish.scoopPrice == null) dish.scoopPrice = Math.round((dish.price || 2000) * 0.25);
              if (dish.platePrice == null) dish.platePrice = dish.price || 2000;
              // Per-piece pricing and sizes were added later, so dishes saved
              // before that have neither field. Default them rather than
              // leaving undefined behind every price calculation.
              if (dish.piecePrice == null) dish.piecePrice = 0;
              if (!Array.isArray(dish.sizes)) dish.sizes = [];
              if (!dish.compulsoryExtras || dish.compulsoryExtras.length === 0) {
                if (dish.addonGroups && dish.addonGroups.length > 0) {
                  const reqGroup = dish.addonGroups.find(g => g.required);
                  if (reqGroup && reqGroup.options) {
                    dish.compulsoryExtras = reqGroup.options.map(o => ({ name: o.name, price: o.price }));
                  }
                }
                if (!dish.compulsoryExtras || dish.compulsoryExtras.length === 0) {
                  dish.compulsoryExtras = [
                    { name: 'chicken', price: 2000 },
                    { name: 'egg', price: 500 }
                  ];
                }
              }
              if (!dish.optionalExtras) {
                dish.optionalExtras = [];
                if (dish.addonGroups && dish.addonGroups.length > 0) {
                  const optGroup = dish.addonGroups.find(g => !g.required);
                  if (optGroup && optGroup.options) {
                    dish.optionalExtras = optGroup.options.map(o => ({ name: o.name, price: o.price }));
                  }
                }
              }
            });
          });

          return parsed;
        }
      } catch (e) {
        console.warn('Failed parsing saved state, initializing fresh store');
      }
    }

    return {
      currentRole: 'customer', // 'customer' | 'vendor' | 'rider' | 'admin'
      selectedLocation: {
        id: 'oou-main',
        name: 'OOU Main Campus Gate, Ago-Iwoye',
        label: 'Campus',
        latitude: 6.8482,
        longitude: 3.6545,
        lat: 6.8482,
        lng: 3.6545,
        accuracy: null,
        locality: 'Ago-Iwoye',
        lga: 'Ijebu North LGA',
        state: 'Ogun',
        country: 'Nigeria',
        formattedAddress: 'OOU Main Campus Gate, Ago-Iwoye, Ogun State, Nigeria',
        zoneId: 'ago-iwoye',
        zoneName: 'Ago-Iwoye (OOU Main Campus)',
        deliveryInstructions: ''
      },
      deliveryConfig: Object.assign({}, DEFAULT_DELIVERY_FEE_CONFIG),
      serviceZones: JSON.parse(JSON.stringify(CHOW45_SERVICE_ZONES)),
      activeCategory: 'all',
      activeFilter: 'all', // 'all' | 'popular' | 'fast' | 'budget' | 'rating'
      searchQuery: '',
      userProfile: {
        name: 'Precious M.',
        phone: '+234 812 450 4500',
        savedAddresses: [],
        favorites: {
          foods: [],
          stores: []
        }
      },
      cart: {
        storeId: null,
        storeName: null,
        items: [] // { dishId, name, price, qty, selectedAddons, itemTotal }
      },
      currentOrderId: null,
      orders: [],
      restaurants: JSON.parse(JSON.stringify(CHOW45_RESTAURANTS)),
      riders: JSON.parse(JSON.stringify(CHOW45_RIDERS)),
      adminLedger: {
        totalGmv: 0,
        totalServiceFees: 0,
        completedDeliveries: 0
      },
      pendingVendors: [],
      vendorOnboarding: {
        status: 'none',
        storeId: null,
        applicationId: null,
        storeName: null,
        appliedAt: null,
        approvedAt: null
      },
      vendorWallet: {
        available: 0,           // shown in big balance tile
        processing: 0           // in-flight withdrawal
      },
      vendorWithdrawals: [],
      disputes: []
    };
  }

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed saving state to localStorage', e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => {
      try {
        cb(this.state);
      } catch (err) {
        console.error('State listener error:', err);
      }
    });
  }

  // -------------------------------------------------------------
  // Role & Filter Navigation
  // -------------------------------------------------------------
  setRole(role) {
    this.state.currentRole = role;
    this.save();
  }

  setLocation(locId) {
    const loc = CHOW45_LOCATIONS.find(l => l.id === locId) || CHOW45_LOCATIONS[0];
    this.state.selectedLocation = loc;
    this.save();
  }

  /**
   * Persist a fully-resolved Mapbox delivery location (from the picker).
   * Also upserts the address into the user's saved addresses.
   */
  setDeliveryLocation(loc) {
    if (!loc || loc.latitude === undefined) return;

    const availability = loc.availability || getServiceAvailability({ lng: loc.longitude, lat: loc.latitude });

    const selected = {
      id: loc.placeId || `loc-${Date.now()}`,
      name: loc.formattedAddress || loc.address || 'Selected location',
      label: loc.label || 'Home',
      latitude: loc.latitude,
      longitude: loc.longitude,
      lat: loc.latitude,
      lng: loc.longitude,
      accuracy: loc.accuracy || null,
      timestamp: loc.timestamp || Date.now(),
      address: loc.address || '',
      locality: loc.locality || '',
      lga: loc.lga || '',
      state: loc.state || (availability.inOgun ? 'Ogun' : ''),
      country: loc.country || 'Nigeria',
      placeId: loc.placeId || null,
      formattedAddress: loc.formattedAddress || '',
      zoneId: loc.zoneId || (availability.zone ? availability.zone.id : null),
      zoneName: loc.zoneName || (availability.zone ? availability.zone.name : null),
      availabilityStatus: availability ? availability.status : null,
      deliveryInstructions: loc.deliveryInstructions || ''
    };

    this.state.selectedLocation = selected;

    // Upsert into saved addresses (max 8).
    const saved = this.state.userProfile.savedAddresses || [];
    const existingIdx = saved.findIndex(a =>
      a.label && a.label.toLowerCase() === (selected.label || '').toLowerCase() &&
      a.state === selected.state
    );
    const entry = {
      label: selected.label,
      address: selected.address || '',
      formattedAddress: selected.formattedAddress || selected.name,
      latitude: selected.latitude,
      longitude: selected.longitude,
      lga: selected.lga,
      state: selected.state,
      placeId: selected.placeId,
      deliveryInstructions: selected.deliveryInstructions,
      isDefault: true
    };
    if (existingIdx > -1) {
      saved[existingIdx] = { ...saved[existingIdx], ...entry };
    } else {
      saved.unshift(entry);
      if (saved.length > 8) saved.pop();
    }
    saved.forEach(a => { a.isDefault = false; });
    if (existingIdx > -1) saved[existingIdx].isDefault = true;
    else saved[0].isDefault = true;

    this.save();
    return selected;
  }

  // -------------------------------------------------------------
  // Admin: Delivery Config & Service Zones
  // -------------------------------------------------------------
  updateDeliveryConfig(patch) {
    this.state.deliveryConfig = Object.assign({}, this.state.deliveryConfig, patch);
    this.save();
  }

  updateServiceZone(zoneId, patch) {
    const idx = this.state.serviceZones.findIndex(z => z.id === zoneId);
    if (idx === -1) return;
    this.state.serviceZones[idx] = Object.assign({}, this.state.serviceZones[idx], patch);
    // Keep in-memory CHOW45_SERVICE_ZONES in sync so the active session uses updated zones.
    const globalIdx = CHOW45_SERVICE_ZONES.findIndex(z => z.id === zoneId);
    if (globalIdx > -1) CHOW45_SERVICE_ZONES[globalIdx] = Object.assign({}, CHOW45_SERVICE_ZONES[globalIdx], patch);
    this.save();
    return this.state.serviceZones[idx];
  }

  addServiceZone(zone) {
    const newZone = Object.assign({
      id: 'zone-' + Date.now(),
      name: 'New Service Zone',
      active: false,
      state: 'Ogun',
      lga: '',
      center: [3.6545, 6.8482],
      maxDeliveryDistance: 3000,
      deliveryRules: { baseFee: 300, ratePerMeter: 0.15, serviceFee: 400 },
      operatingHours: { open: '08:00', close: '23:00' },
      polygon: [
        [3.6400, 6.8300], [3.6700, 6.8300], [3.6700, 6.8600], [3.6400, 6.8600], [3.6400, 6.8300]
      ]
    }, zone);
    this.state.serviceZones.push(newZone);
    CHOW45_SERVICE_ZONES.push(newZone);
    this.save();
    return newZone;
  }

  setCategory(catId) {
    this.state.activeCategory = catId;
    this.save();
  }

  setFilter(filterId) {
    this.state.activeFilter = filterId;
    this.save();
  }

  setSearchQuery(q) {
    this.state.searchQuery = q;
    this.save();
  }

  // -------------------------------------------------------------
  // Favorites Management
  // -------------------------------------------------------------
  toggleFavoriteFood(dishId) {
    const favs = this.state.userProfile.favorites.foods;
    const index = favs.indexOf(dishId);
    if (index > -1) {
      favs.splice(index, 1);
    } else {
      favs.push(dishId);
    }
    this.save();
    return index === -1; // true if added
  }

  toggleFavoriteStore(storeId) {
    const favs = this.state.userProfile.favorites.stores;
    const index = favs.indexOf(storeId);
    if (index > -1) {
      favs.splice(index, 1);
    } else {
      favs.push(storeId);
    }
    this.save();
    return index === -1;
  }

  // -------------------------------------------------------------
  // Cart Actions & "1 Cart = 1 Store" Rule
  // -------------------------------------------------------------
  addToCart(restaurant, item, onConflict) {
    const currentStoreId = this.state.cart.storeId;

    // Strict 1 Cart = 1 Store rule
    if (currentStoreId && currentStoreId !== restaurant.id && this.state.cart.items.length > 0) {
      if (onConflict) {
        onConflict({
          currentStoreName: this.state.cart.storeName,
          newStoreName: restaurant.name,
          resolve: (clearAndAdd) => {
            if (clearAndAdd) {
              this.clearCart();
              this._executeAddToCart(restaurant, item);
            }
          }
        });
      }
      return false;
    }

    this._executeAddToCart(restaurant, item);
    return true;
  }

  _executeAddToCart(restaurant, item) {
    this.state.cart.storeId = restaurant.id;
    this.state.cart.storeName = restaurant.name;

    const existingIndex = this.state.cart.items.findIndex(i =>
      i.dishId === item.dishId && JSON.stringify(i.selectedAddons || []) === JSON.stringify(item.selectedAddons || [])
    );

    if (existingIndex > -1) {
      this.state.cart.items[existingIndex].qty += item.qty;
      this.state.cart.items[existingIndex].itemTotal += item.itemTotal;
    } else {
      this.state.cart.items.push(item);
    }

    this.save();
  }

  updateCartItemQty(index, delta) {
    if (this.state.cart.items[index]) {
      const item = this.state.cart.items[index];
      const unitPrice = item.itemTotal / item.qty;
      item.qty += delta;

      if (item.qty <= 0) {
        this.state.cart.items.splice(index, 1);
      } else {
        item.itemTotal = unitPrice * item.qty;
      }

      if (this.state.cart.items.length === 0) {
        this.state.cart.storeId = null;
        this.state.cart.storeName = null;
      }

      this.save();
    }
  }

  clearCart() {
    this.state.cart = {
      storeId: null,
      storeName: null,
      items: []
    };
    this.save();
  }

  getCartSubtotal() {
    return this.state.cart.items.reduce((sum, item) => sum + (item.itemTotal || 0), 0);
  }

  getCartCount() {
    return this.state.cart.items.reduce((sum, item) => sum + (item.qty || 0), 0);
  }

  // -------------------------------------------------------------
  // Order Management & Order State Machine
  // -------------------------------------------------------------
  createOrder(orderDetails) {
    const store = this.state.restaurants.find(r => r.id === orderDetails.storeId);
    const config = this.state.deliveryConfig || DEFAULT_DELIVERY_FEE_CONFIG;

    // Delivery quote comes from the Mapbox route (server-validated when available).
    const quote = orderDetails.deliveryQuote || null;
    const distanceKm = quote
      ? quote.distanceMeters / 1000
      : (store ? store.distanceKm : 1.8);
    const deliveryFee = quote
      ? quote.deliveryFee
      : calculateDeliveryFee(distanceKm * 1000, config);
    const subtotal = this.getCartSubtotal();
    const serviceFee = (config ? config.serviceFee : null) || MANDATORY_SERVICE_FEE;
    const total = subtotal + serviceFee + deliveryFee;

    const newOrder = {
      id: `CH45${Math.floor(100 + Math.random() * 900)}`,
      storeId: orderDetails.storeId,
      storeName: orderDetails.storeName,
      customerName: orderDetails.customerName || this.state.userProfile.name,
      customerPhone: orderDetails.customerPhone || this.state.userProfile.phone,
      deliveryAddress: orderDetails.deliveryAddress || this.state.selectedLocation.name,
      deliveryNotes: orderDetails.deliveryNotes || '',
      paymentMethod: orderDetails.paymentMethod || 'Debit Card (Paystack)',
      items: JSON.parse(JSON.stringify(this.state.cart.items)),
      deliveryLocation: orderDetails.deliveryLocation || null,
      routeDistanceMeters: quote ? quote.distanceMeters : null,
      estimatedDurationSeconds: quote ? quote.durationSeconds : null,
      subtotal,
      serviceFee,
      deliveryFee,
      total,
      status: 'PAID', // Start confirmed
      createdAt: new Date().toISOString(),
      riderId: null,
      riderName: null,
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      history: [
        { status: 'PAID', timestamp: new Date().toISOString(), note: 'Payment successful! Sent to restaurant' }
      ]
    };

    this.state.orders.unshift(newOrder);
    this.state.currentOrderId = newOrder.id;

    // Platform Ledger
    this.state.adminLedger.totalGmv += total;
    this.state.adminLedger.totalServiceFees += serviceFee;

    this.clearCart();
    this.save();
    return newOrder;
  }

  advanceOrderStatus(orderId, nextStatus, extra = {}) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = nextStatus;
    if (extra.riderId) {
      order.riderId = extra.riderId;
      order.riderName = extra.riderName;
    }

    if (!order.history) order.history = [];
    order.history.push({
      status: nextStatus,
      timestamp: new Date().toISOString(),
      note: ORDER_STAGES[nextStatus]?.humanText || nextStatus
    });

    if (nextStatus === 'DELIVERED') {
      this.state.adminLedger.completedDeliveries += 1;
    }

    this.save();
    return order;
  }

  submitOrderReview(orderId, rating, comment) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (order) {
      order.review = { rating, comment, submittedAt: new Date().toISOString() };
      this.save();
    }
  }

  reportDispute(orderId, reason, details) {
    const dispute = {
      id: `DISP-${Date.now()}`,
      orderId,
      reason,
      details,
      status: 'open',
      createdAt: new Date().toISOString()
    };
    this.state.disputes.unshift(dispute);
    this.save();
    return dispute;
  }

  resolveDispute(disputeId, resolution) {
    const dispute = this.state.disputes.find(d => d.id === disputeId);
    if (dispute) {
      dispute.status = 'resolved';
      dispute.resolution = resolution;
      this.save();
    }
  }

  // -------------------------------------------------------------
  // Vendor Inventory Toggles & Onboarding
  // -------------------------------------------------------------
  toggleDishStock(storeId, dishId) {
    const store = this.state.restaurants.find(r => r.id === storeId);
    if (store) {
      const dish = store.menu.find(d => d.id === dishId);
      if (dish) {
        dish.inStock = !dish.inStock;
        this.save();
        return dish.inStock;
      }
    }
    return false;
  }

  toggleStoreOpen(storeId) {
    const store = this.state.restaurants.find(r => r.id === storeId);
    if (store) {
      store.open = !store.open;
      this.save();
      return store.open;
    }
    return false;
  }

  registerVendor(vendorData) {
    const applicationId = vendorData.applicationId || `app-${Date.now()}`;
    const newPending = {
      id: `pv-${Date.now()}`,
      applicationId,
      name: vendorData.storeName,
      ownerName: vendorData.ownerName,
      ownerEmail: vendorData.email || '',
      ownerPhone: vendorData.phone || '',
      location: vendorData.address,
      pickupLat: vendorData.pickupLat || null,
      pickupLng: vendorData.pickupLng || null,
      pickupAddress: vendorData.pickupAddress || null,
      lga: vendorData.lga || 'Sagamu LGA',
      phone: vendorData.phone,
      openingTime: vendorData.openingTime || '',
      closingTime: vendorData.closingTime || '',
      appliedAt: 'Just now',
      cuisine: vendorData.cuisine || 'Nigerian Specialties',
      status: 'pending',
      coverImg: vendorData.coverImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
    };
    this.state.pendingVendors.unshift(newPending);
    this.state.vendorOnboarding = {
      status: 'pending',
      storeId: null,
      applicationId,
      storeName: vendorData.storeName,
      appliedAt: new Date().toISOString(),
      approvedAt: null
    };
    this.save();
    return newPending;
  }

  approveVendor(pvId) {
    const index = this.state.pendingVendors.findIndex(v => v.id === pvId);
    if (index > -1) {
      const v = this.state.pendingVendors[index];
      this.state.pendingVendors.splice(index, 1);
      const newRest = {
        id: `rest-${Date.now()}`,
        name: v.name,
        slug: v.name.toLowerCase().replace(/\s+/g, '-'),
        rating: 5.0,
        reviewsCount: 1,
        prepTime: '20–30 min',
        distanceKm: 2.0,
        deliveryFee: 650,
        address: v.pickupAddress || v.location,
        openingTime: v.openingTime || '7:00 AM',
        closingTime: v.closingTime || '9:00 PM',
        lat: Number(v.pickupLat) || 6.8482,
        lng: Number(v.pickupLng) || 3.6545,
        open: true,
        isVerified: true,
        tags: [v.cuisine, 'Verified Store'],
        category: 'rice',
        isBudget: true,
        isRecommended: true,
        isPopular: false,
        isFast: true,
        bannerImg: v.coverImg,
        menu: []
      };
      this.state.restaurants.unshift(newRest);
      // Link the approval back to the vendor's onboarding flow.
      this.state.vendorOnboarding = {
        status: 'approved',
        storeId: newRest.id,
        applicationId: v.applicationId,
        storeName: newRest.name,
        appliedAt: this.state.vendorOnboarding.appliedAt || new Date().toISOString(),
        approvedAt: new Date().toISOString()
      };
      this.save();
    }
  }

  rejectVendor(pvId, reason = 'Verification documents incomplete') {
    const index = this.state.pendingVendors.findIndex(v => v.id === pvId);
    if (index > -1) {
      const v = this.state.pendingVendors[index];
      this.state.pendingVendors.splice(index, 1);
      this.state.vendorOnboarding = {
        status: 'rejected',
        storeId: null,
        applicationId: v.applicationId,
        storeName: v.name,
        appliedAt: this.state.vendorOnboarding.appliedAt || new Date().toISOString(),
        rejectionReason: reason
      };
      this.save();
    }
  }

  /** Vendor menu management */
  addDish(storeId, dishData) {
    const store = this.state.restaurants.find(r => r.id === storeId);
    if (!store) return null;

    // Harmonize pricing and availability
    const priceType = dishData.priceType || 'PLATE';
    const scoopPrice = Number(dishData.scoopPrice) || 0;
    const platePrice = Number(dishData.platePrice) || 0;
    const piecePrice = Number(dishData.piecePrice) || 0;
    // Sizes only apply to by-piece items; drop them for anything else so a
    // stale builder cannot resurface on a scoop/plate dish.
    const sizes = (Array.isArray(dishData.sizes) && priceType === 'PIECE')
      ? dishData.sizes
          .filter(s => s && String(s.name || '').trim())
          .map((s, i) => ({
            id: s.id || `sz-${Date.now()}-${i}`,
            name: String(s.name).trim(),
            price: Number(s.price) || 0
          }))
      : [];
    let basePrice = Number(dishData.price) || 0;
    if (priceType === 'SCOOP') basePrice = scoopPrice;
    else if (priceType === 'PLATE') basePrice = platePrice;
    else if (priceType === 'BOTH') basePrice = scoopPrice || platePrice;
    else if (priceType === 'PIECE') basePrice = piecePrice;

    const status = dishData.status || (dishData.inStock === false ? 'OUT_OF_STOCK' : 'AVAILABLE');
    const inStock = status === 'AVAILABLE' || status === 'PREORDER';

    // Synchronize addon groups for customer customizer
    let addonGroups = dishData.addonGroups || [];
    const compulsory = dishData.compulsoryExtras || [];
    const optional = dishData.optionalExtras || [];
    if (compulsory.length > 0 || optional.length > 0) {
      addonGroups = [];
      if (compulsory.length > 0) {
        addonGroups.push({
          title: 'Choose compulsory extra',
          required: true,
          options: compulsory.map(e => ({ name: e.name, price: Number(e.price) || 0 }))
        });
      }
      if (optional.length > 0) {
        addonGroups.push({
          title: 'Optional extras',
          required: false,
          options: optional.map(e => ({ name: e.name, price: Number(e.price) || 0 }))
        });
      }
    }

    // One id per item, generated once. Using Date.now() alone collided when
    // two items were added inside the same millisecond, and the id has to be
    // stable because it is the key used to sync the item to the server.
    const dishId = `dish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const dish = Object.assign({
      id: dishId,
      name: 'New Food Item',
      desc: '',
      price: basePrice,
      priceType,
      scoopPrice,
      platePrice,
      piecePrice,
      sizes,
      status,
      inStock,
      preorderEnabled: Boolean(dishData.preorderEnabled),
      preorderDate: dishData.preorderDate || '',
      preorderTime: dishData.preorderTime || '',
      compulsoryExtras: compulsory,
      optionalExtras: optional,
      img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=80',
      category: 'rice',
      rating: 4.8,
      prepTime: '20–30 min',
      isPopular: false,
      addonGroups
    }, dishData, {
      id: dishId,
      price: basePrice,
      // Re-applied after dishData so the sanitised numbers and the
      // coerced size array win over the raw draft values.
      piecePrice,
      sizes,
      inStock,
      status,
      addonGroups
    });

    if (!Array.isArray(store.menu)) store.menu = [];
    store.menu.unshift(dish);
    this.save();
    return dish;
  }

  updateDish(storeId, dishId, patch) {
    const store = this.state.restaurants.find(r => r.id === storeId);
    if (!store) return null;
    const dish = store.menu.find(d => d.id === dishId);
    if (!dish) return null;

    // Recalculate price if pricing changed
    const priceType = patch.priceType || dish.priceType || 'PLATE';
    const scoopPrice = patch.scoopPrice !== undefined ? Number(patch.scoopPrice) || 0 : (dish.scoopPrice || 0);
    const platePrice = patch.platePrice !== undefined ? Number(patch.platePrice) || 0 : (dish.platePrice || 0);
    const piecePrice = patch.piecePrice !== undefined ? Number(patch.piecePrice) || 0 : (dish.piecePrice || 0);
    const sizes = priceType === 'PIECE'
      ? (patch.sizes !== undefined
          ? patch.sizes
              .filter(s => s && String(s.name || '').trim())
              .map((s, i) => ({
                id: s.id || `sz-${Date.now()}-${i}`,
                name: String(s.name).trim(),
                price: Number(s.price) || 0
              }))
          : (dish.sizes || []))
      : [];
    let basePrice = patch.price !== undefined ? Number(patch.price) || 0 : dish.price;
    if (priceType === 'SCOOP') basePrice = scoopPrice;
    else if (priceType === 'PLATE') basePrice = platePrice;
    else if (priceType === 'BOTH') basePrice = scoopPrice || platePrice;
    else if (priceType === 'PIECE') basePrice = piecePrice;

    // Status & stock synchronization
    let status = patch.status || dish.status;
    if (patch.inStock !== undefined && !patch.status) {
      status = patch.inStock ? 'AVAILABLE' : 'OUT_OF_STOCK';
    }
    const inStock = status === 'AVAILABLE' || status === 'PREORDER';

    // Synchronize addon groups
    const compulsory = patch.compulsoryExtras !== undefined ? patch.compulsoryExtras : (dish.compulsoryExtras || []);
    const optional = patch.optionalExtras !== undefined ? patch.optionalExtras : (dish.optionalExtras || []);
    let addonGroups = patch.addonGroups !== undefined ? patch.addonGroups : (dish.addonGroups || []);
    if (patch.compulsoryExtras !== undefined || patch.optionalExtras !== undefined) {
      addonGroups = [];
      if (compulsory.length > 0) {
        addonGroups.push({
          title: 'Choose compulsory extra',
          required: true,
          options: compulsory.map(e => ({ name: e.name, price: Number(e.price) || 0 }))
        });
      }
      if (optional.length > 0) {
        addonGroups.push({
          title: 'Optional extras',
          required: false,
          options: optional.map(e => ({ name: e.name, price: Number(e.price) || 0 }))
        });
      }
    }

    Object.assign(dish, patch, {
      priceType,
      scoopPrice,
      platePrice,
      // Applied after patch so string prices from the form cannot survive.
      piecePrice,
      sizes,
      price: basePrice,
      status,
      inStock,
      compulsoryExtras: compulsory,
      optionalExtras: optional,
      addonGroups
    });

    this.save();
    return dish;
  }

  deleteDish(storeId, dishId) {
    const store = this.state.restaurants.find(r => r.id === storeId);
    if (!store || !store.menu) return false;
    const idx = store.menu.findIndex(d => d.id === dishId);
    if (idx === -1) return false;
    store.menu.splice(idx, 1);
    this.save();
    return true;
  }

  toggleDishStatus(storeId, dishId, newStatus) {
    const store = this.state.restaurants.find(r => r.id === storeId);
    if (!store || !store.menu) return null;
    const dish = store.menu.find(d => d.id === dishId);
    if (!dish) return null;

    if (!newStatus) {
      newStatus = dish.status === 'AVAILABLE' ? 'OUT_OF_STOCK' : 'AVAILABLE';
    }
    dish.status = newStatus;
    dish.inStock = (newStatus === 'AVAILABLE' || newStatus === 'PREORDER');
    this.save();
    return dish;
  }

  /** Simple withdrawals with plain-language statuses */
  requestWithdrawal(amount, bankName, accountNumber) {
    const amt = Math.max(0, Number(amount) || 0);
    const wallet = this.state.vendorWallet;
    if (amt <= 0 || amt > wallet.available) return null;

    const withdrawal = {
      id: `wd-${Date.now()}`,
      amount: amt,
      bankName,
      accountNumber,
      status: 'processing',
      requestedAt: new Date().toISOString(),
      expectedPayDate: new Date(new Date().getTime() + 86400000).toISOString() // tomorrow
    };
    this.state.vendorWithdrawals.unshift(withdrawal);
    wallet.available = Math.max(0, wallet.available - amt);
    wallet.processing = wallet.processing + amt;
    this.save();
    return withdrawal;
  }

  markWithdrawalPaid(id) {
    const w = this.state.vendorWithdrawals.find(x => x.id === id);
    if (!w || w.status === 'paid') return null;
    w.status = 'paid';
    w.paidOutAt = new Date().toISOString();
    this.state.vendorWallet.processing = Math.max(0, this.state.vendorWallet.processing - w.amount);
    this.save();
    return w;
  }
}

window.chowStore = new Chow45Store();
