/**
 * CHOW45 UNIFIED REACTIVE STATE ENGINE
 * Synchronizes state across all 4 roles: Customer, Vendor, Rider, and Admin
 * Persisted in localStorage with event dispatching.
 */

const ORDER_STAGES = {
  PENDING_PAYMENT: { key: 'PENDING_PAYMENT', label: 'Payment Pending', humanText: 'Awaiting your payment confirmation', stepIndex: 0 },
  PAID: { key: 'PAID', label: 'Paid & Submitted', humanText: 'Order confirmed! Sent to restaurant', stepIndex: 1 },
  STORE_CONFIRMED: { key: 'STORE_CONFIRMED', label: 'Store Confirmed', humanText: 'Restaurant accepted your order', stepIndex: 2 },
  PREPARING: { key: 'PREPARING', label: 'In Kitchen', humanText: 'Chef is preparing your meal fresh with love', stepIndex: 3 },
  READY_FOR_PICKUP: { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', humanText: 'Order is packaged and ready at the store', stepIndex: 4 },
  RIDER_ASSIGNED: { key: 'RIDER_ASSIGNED', label: 'Rider Dispatched', humanText: 'Rider assigned and riding to the restaurant', stepIndex: 5 },
  RIDER_AT_STORE: { key: 'RIDER_AT_STORE', label: 'Rider at Restaurant', humanText: 'Rider arrived at restaurant to collect your food', stepIndex: 6 },
  PICKED_UP: { key: 'PICKED_UP', label: 'Food Picked Up', humanText: 'Food secured in thermal delivery box', stepIndex: 7 },
  OUT_FOR_DELIVERY: { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', humanText: 'Rider is on the way to your doorstep!', stepIndex: 8 },
  DELIVERED: { key: 'DELIVERED', label: 'Delivered', humanText: 'Order delivered successfully. Enjoy your meal!', stepIndex: 9 }
};

class Chow45Store {
  constructor() {
    this.STORAGE_KEY = 'chow45_marketplace_state_v1';
    this.listeners = [];
    this.state = this.loadInitialState();
  }

  loadInitialState() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure restaurants list is present
        if (!parsed.restaurants || parsed.restaurants.length === 0) {
          parsed.restaurants = JSON.parse(JSON.stringify(CHOW45_RESTAURANTS));
        }
        return parsed;
      } catch (e) {
        console.warn('Failed parsing saved state, restoring seeds');
      }
    }

    return {
      currentRole: 'customer', // 'customer' | 'vendor' | 'rider' | 'admin'
      selectedLocation: CHOW45_LOCATIONS[0],
      activeCategory: 'all',
      searchQuery: '',
      cart: {
        storeId: null,
        storeName: null,
        items: [] // { dishId, name, price, qty, selectedAddons, itemTotal }
      },
      currentOrderId: null,
      orders: [
        {
          id: 'ORD-4501',
          storeId: 'rest-1',
          storeName: 'Mama Put OOU Special',
          customerName: 'Bisi Ogunleye',
          customerPhone: '+234 813 555 0192',
          deliveryAddress: 'Hall of Residence 3, Room B12, OOU Sagamu Campus',
          status: 'DELIVERED',
          items: [
            { name: 'Smokey Party Jollof & Peppered Chicken', qty: 1, price: 2600, addons: ['Extra Dodo'] }
          ],
          subtotal: 3100,
          serviceFee: 500,
          deliveryFee: 400,
          total: 4000,
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          riderId: 'rider-1',
          riderName: 'Tunde Adeleke',
          pin: '4591'
        }
      ],
      restaurants: JSON.parse(JSON.stringify(CHOW45_RESTAURANTS)),
      riders: JSON.parse(JSON.stringify(CHOW45_RIDERS)),
      adminLedger: {
        totalGmv: 4000,
        totalServiceFees: 500,
        completedDeliveries: 1
      },
      pendingVendors: [
        {
          id: 'pv-1',
          name: 'Iya Moria Bukateria',
          location: 'Faculty of Science Canteen, Ago Iwoye',
          appliedAt: '2 hours ago',
          cuisine: 'Local Amala & Pepper Soup',
          status: 'pending'
        }
      ]
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
  // Role Navigation
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

  setSearchQuery(q) {
    this.state.searchQuery = q;
    this.save();
  }

  // -------------------------------------------------------------
  // Cart Actions & "Single-Store Rule"
  // -------------------------------------------------------------
  addToCart(restaurant, item, onConflict) {
    const currentStoreId = this.state.cart.storeId;

    // Check single-store rule
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

    // Check if same dish with same selected addons already exists
    const existingIndex = this.state.cart.items.findIndex(i =>
      i.dishId === item.dishId && JSON.stringify(i.selectedAddons) === JSON.stringify(item.selectedAddons)
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
    const distanceKm = store ? store.distanceKm : 1.5;
    const deliveryFee = calculateDeliveryFee(distanceKm);
    const subtotal = this.getCartSubtotal();
    const serviceFee = MANDATORY_SERVICE_FEE;
    const total = subtotal + serviceFee + deliveryFee;

    const newOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      storeId: orderDetails.storeId,
      storeName: orderDetails.storeName,
      customerName: orderDetails.customerName || 'Chow45 Customer',
      customerPhone: orderDetails.customerPhone || '+234 812 000 4500',
      deliveryAddress: orderDetails.deliveryAddress || this.state.selectedLocation.name,
      deliveryNotes: orderDetails.deliveryNotes || '',
      paymentMethod: orderDetails.paymentMethod || 'Card / Paystack',
      items: JSON.parse(JSON.stringify(this.state.cart.items)),
      subtotal,
      serviceFee,
      deliveryFee,
      total,
      status: 'PAID', // Start as paid
      createdAt: new Date().toISOString(),
      riderId: null,
      riderName: null,
      pin: String(Math.floor(1000 + Math.random() * 9000)), // 4-digit dropoff PIN
      history: [
        { status: 'PAID', timestamp: new Date().toISOString(), note: 'Payment verified successfully.' }
      ]
    };

    this.state.orders.unshift(newOrder);
    this.state.currentOrderId = newOrder.id;

    // Update platform ledger
    this.state.adminLedger.totalGmv += total;
    this.state.adminLedger.totalServiceFees += serviceFee;

    // Clear cart after placement
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

  // -------------------------------------------------------------
  // Vendor Inventory Toggles
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

  // -------------------------------------------------------------
  // Admin Vendor Approvals
  // -------------------------------------------------------------
  approveVendor(pvId) {
    const index = this.state.pendingVendors.findIndex(v => v.id === pvId);
    if (index > -1) {
      const v = this.state.pendingVendors[index];
      this.state.pendingVendors.splice(index, 1);
      // Create new restaurant from pending
      const newRest = {
        id: `rest-${this.state.restaurants.length + 1}`,
        name: v.name,
        slug: v.name.toLowerCase().replace(/\s+/g, '-'),
        rating: 5.0,
        reviewsCount: 1,
        prepTime: '20 - 30 min',
        distanceKm: 1.8,
        deliveryFee: 450,
        tags: [v.cuisine, 'Verified Partner'],
        category: 'swallow',
        isBudget: true,
        bannerImg: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
        address: v.location,
        lat: 6.8410,
        lng: 3.6510,
        open: true,
        menu: [
          {
            id: `dish-pv-${Date.now()}`,
            name: `${v.cuisine} Signature Plate`,
            desc: 'Freshly prepared specialty dish from this verified vendor.',
            price: 2500,
            img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
            inStock: true,
            addonGroups: []
          }
        ]
      };
      this.state.restaurants.push(newRest);
      this.save();
    }
  }

  rejectVendor(pvId) {
    this.state.pendingVendors = this.state.pendingVendors.filter(v => v.id !== pvId);
    this.save();
  }
}

// Global singleton instance
window.chowStore = new Chow45Store();
