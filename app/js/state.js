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
  DELIVERED: { key: 'DELIVERED', label: 'Delivered', humanText: 'Your food has been delivered! Enjoy your meal.', stepIndex: 11 }
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
          return parsed;
        }
      } catch (e) {
        console.warn('Failed parsing saved state, initializing fresh store');
      }
    }

    return {
      currentRole: 'customer', // 'customer' | 'vendor' | 'rider' | 'admin'
      selectedLocation: CHOW45_LOCATIONS[0], // 9 Goshen Ave, Idimu, Lagos
      activeCategory: 'all',
      activeFilter: 'all', // 'all' | 'popular' | 'fast' | 'budget' | 'rating'
      searchQuery: '',
      userProfile: {
        name: 'Precious M.',
        phone: '+234 812 450 4500',
        email: 'precious@chow45.com',
        savedAddresses: [
          { label: 'Home', address: '9 Goshen Ave, Idimu, Lagos', isDefault: true },
          { label: 'Work', address: 'Egbeda Bus Stop, Akowonjo Rd, Lagos', isDefault: false },
          { label: 'School', address: 'OOU Main Campus Gate, Sagamu', isDefault: false }
        ],
        favorites: {
          foods: ['dish-mt-1', 'dish-suya-1'],
          stores: ['rest-mama-t']
        }
      },
      cart: {
        storeId: null,
        storeName: null,
        items: [] // { dishId, name, price, qty, selectedAddons, itemTotal }
      },
      currentOrderId: null,
      orders: [
        {
          id: 'CH45281',
          storeId: 'rest-mama-t',
          storeName: "Mama T's Kitchen",
          customerName: 'Precious M.',
          customerPhone: '+234 812 450 4500',
          deliveryAddress: 'Home • 9 Goshen Ave, Idimu, Lagos',
          status: 'DELIVERED',
          items: [
            { name: 'Jollof Rice', qty: 1, unitPrice: 3500, selectedAddons: [{ name: 'Peppered Chicken', price: 1500 }, { name: 'Fried Plantain (Dodo)', price: 700 }], itemTotal: 5200 }
          ],
          subtotal: 5200,
          deliveryFee: 800,
          serviceFee: 500,
          total: 6500,
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          riderId: 'rider-david',
          riderName: 'David Adeleke',
          pin: '4528',
          review: {
            rating: 5,
            comment: 'Food was steaming hot and delicious! Fast delivery to Idimu.'
          }
        }
      ],
      restaurants: JSON.parse(JSON.stringify(CHOW45_RESTAURANTS)),
      riders: JSON.parse(JSON.stringify(CHOW45_RIDERS)),
      adminLedger: {
        totalGmv: 6500,
        totalServiceFees: 500,
        completedDeliveries: 1
      },
      pendingVendors: [
        {
          id: 'pv-101',
          name: 'Iya Moria Bukateria',
          ownerName: 'Moria Alabi',
          location: 'Shop 14, Council Market, Idimu, Lagos',
          lga: 'Alimosho LGA',
          phone: '+234 802 331 4492',
          appliedAt: 'Today, 2:15 PM',
          cuisine: 'Authentic Amala, Ewedu & Gbegiri',
          status: 'pending',
          coverImg: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
          regNumber: 'BN-4920194'
        }
      ],
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
    const distanceKm = store ? store.distanceKm : 1.8;
    const deliveryFee = store ? store.deliveryFee : calculateDeliveryFee(distanceKm);
    const subtotal = this.getCartSubtotal();
    const serviceFee = MANDATORY_SERVICE_FEE;
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
    const newPending = {
      id: `pv-${Date.now()}`,
      name: vendorData.storeName,
      ownerName: vendorData.ownerName,
      location: vendorData.address,
      lga: vendorData.lga || 'Alimosho LGA',
      phone: vendorData.phone,
      appliedAt: 'Just now',
      cuisine: vendorData.cuisine || 'Nigerian Specialties',
      status: 'pending',
      coverImg: vendorData.coverImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
    };
    this.state.pendingVendors.unshift(newPending);
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
        address: v.location,
        lat: 6.5780,
        lng: 3.2710,
        open: true,
        isVerified: true,
        tags: [v.cuisine, 'Verified Store'],
        category: 'rice',
        isBudget: true,
        isRecommended: true,
        isPopular: false,
        isFast: true,
        bannerImg: v.coverImg,
        menu: [
          {
            id: `dish-pv-${Date.now()}`,
            name: `${v.cuisine} Special Platter`,
            desc: 'Signature dish prepared with fresh local ingredients.',
            price: 3200,
            img: v.coverImg,
            inStock: true,
            category: 'rice',
            rating: 5.0,
            prepTime: '20–30 min',
            isPopular: true,
            addonGroups: []
          }
        ]
      };
      this.state.restaurants.unshift(newRest);
      this.save();
    }
  }

  rejectVendor(pvId, reason = 'Verification documents incomplete') {
    const index = this.state.pendingVendors.findIndex(v => v.id === pvId);
    if (index > -1) {
      this.state.pendingVendors.splice(index, 1);
      this.save();
    }
  }
}

window.chowStore = new Chow45Store();
