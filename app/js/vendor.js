/**
 * CHOW45 VENDOR PORTAL CONTROLLER
 * Kitchen order queue fulfillment, inventory in/out-of-stock toggles, store status
 */

const VendorController = {
  currentStoreId: 'rest-1', // Defaults to Mama Put OOU Special
  activeTab: 'incoming', // 'incoming' | 'preparing' | 'ready' | 'history'

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    window.chowStore.subscribe(() => {
      this.render();
    });
  },

  setStore(storeId) {
    this.currentStoreId = storeId;
    this.render();
  },

  setTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  getStore() {
    return window.chowStore.state.restaurants.find(r => r.id === this.currentStoreId) || window.chowStore.state.restaurants[0];
  },

  render() {
    const store = this.getStore();
    if (!store) return;

    // Render Store Header
    const avatar = document.getElementById('vendor-store-avatar');
    if (avatar) avatar.src = store.bannerImg;
    const name = document.getElementById('vendor-store-name');
    if (name) name.innerText = store.name;
    const loc = document.getElementById('vendor-store-location');
    if (loc) loc.innerText = store.address;

    // Toggle switch
    const toggle = document.getElementById('vendor-open-toggle');
    const label = document.getElementById('vendor-open-label');
    if (toggle && label) {
      if (store.open) {
        toggle.classList.add('on');
        label.innerText = 'Store is OPEN for orders';
        label.style.color = 'var(--c-primary)';
      } else {
        toggle.classList.remove('on');
        label.innerText = 'Store is CLOSED';
        label.style.color = '#DC2626';
      }
    }

    // Render KPIs
    const storeOrders = window.chowStore.state.orders.filter(o => o.storeId === store.id);
    const completedOrders = storeOrders.filter(o => o.status === 'DELIVERED');
    const todayRevenue = completedOrders.reduce((sum, o) => sum + o.subtotal, 0);

    const revEl = document.getElementById('vendor-kpi-revenue');
    if (revEl) revEl.innerText = `₦${todayRevenue.toLocaleString()}`;
    const countEl = document.getElementById('vendor-kpi-count');
    if (countEl) countEl.innerText = storeOrders.length;

    // Render Kitchen Orders
    this.renderKitchenOrders(storeOrders);

    // Render Inventory
    this.renderInventory(store);
  },

  toggleStoreStatus() {
    const store = this.getStore();
    if (!store) return;
    const newState = window.chowStore.toggleStoreOpen(store.id);
    window.chowApp.toast(newState ? 'Your restaurant is now OPEN to receive orders' : 'Your restaurant is now CLOSED', newState ? 'success' : 'warning');
  },

  renderKitchenOrders(storeOrders) {
    const container = document.getElementById('vendor-orders-list');
    if (!container) return;

    // Tab counts
    const incoming = storeOrders.filter(o => o.status === 'PAID');
    const preparing = storeOrders.filter(o => o.status === 'STORE_CONFIRMED' || o.status === 'PREPARING');
    const ready = storeOrders.filter(o => o.status === 'READY_FOR_PICKUP' || o.status === 'RIDER_ASSIGNED' || o.status === 'RIDER_AT_STORE');
    const completed = storeOrders.filter(o => o.status === 'PICKED_UP' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'DELIVERED');

    const incCount = document.getElementById('vendor-count-incoming');
    if (incCount) incCount.innerText = incoming.length;
    const prepCount = document.getElementById('vendor-count-preparing');
    if (prepCount) prepCount.innerText = preparing.length;
    const readyCount = document.getElementById('vendor-count-ready');
    if (readyCount) readyCount.innerText = ready.length;

    let displayOrders = [];
    if (this.activeTab === 'incoming') displayOrders = incoming;
    else if (this.activeTab === 'preparing') displayOrders = preparing;
    else if (this.activeTab === 'ready') displayOrders = ready;
    else displayOrders = completed;

    if (displayOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: white; border-radius: var(--radius-xl); border: 1px dashed var(--c-border);">
          <div style="font-size: 2rem; margin-bottom: 8px;">👨‍🍳</div>
          <p style="font-weight: 700; color: var(--c-text-primary);">No orders in this tab right now</p>
          <p style="font-size: 0.8rem; color: var(--c-text-muted);">New customer orders will ring here automatically.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = displayOrders.map(order => {
      let actionBtn = '';
      if (order.status === 'PAID') {
        actionBtn = `
          <button class="action-btn-primary" onclick="VendorController.advanceOrder('${order.id}', 'STORE_CONFIRMED')">
            Accept & Start Cooking
          </button>
        `;
      } else if (order.status === 'STORE_CONFIRMED') {
        actionBtn = `
          <button class="action-btn-primary" onclick="VendorController.advanceOrder('${order.id}', 'PREPARING')">
            Mark in Kitchen (Preparing)
          </button>
        `;
      } else if (order.status === 'PREPARING') {
        actionBtn = `
          <button class="action-btn-primary" style="background: #10B981;" onclick="VendorController.advanceOrder('${order.id}', 'READY_FOR_PICKUP')">
            Packaged & Ready for Rider
          </button>
        `;
      } else {
        actionBtn = `<span style="font-size: 0.8rem; color: var(--c-text-secondary); font-weight: 700;">Status: ${ORDER_STAGES[order.status]?.label || order.status}</span>`;
      }

      return `
        <div class="kitchen-order-card">
          <div class="order-top-row">
            <div>
              <span class="order-id-badge">${order.id}</span>
              <span style="font-size: 0.8rem; color: var(--c-text-secondary); margin-left: 8px;">${order.customerName} (${order.customerPhone})</span>
            </div>
            <span class="order-stage-tag ${order.status === 'READY_FOR_PICKUP' ? 'ready' : ''}">${ORDER_STAGES[order.status]?.label || order.status}</span>
          </div>

          <div class="order-items-box">
            ${order.items.map(item => `
              <div class="order-item-line">
                <span><strong>${item.qty}x</strong> ${item.name} ${item.selectedAddons && item.selectedAddons.length ? '(' + item.selectedAddons.map(a => a.name).join(', ') + ')' : ''}</span>
                <strong>₦${item.itemTotal.toLocaleString()}</strong>
              </div>
            `).join('')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--c-text-secondary);">
            <span>📍 ${order.deliveryAddress}</span>
            <strong style="color: var(--c-text-primary); font-size: 0.95rem;">Food Subtotal: ₦${order.subtotal.toLocaleString()}</strong>
          </div>

          <div class="order-actions-row">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  },

  advanceOrder(orderId, newStatus) {
    window.chowStore.advanceOrderStatus(orderId, newStatus);
    window.chowApp.toast(`Order ${orderId} updated to ${ORDER_STAGES[newStatus]?.label}`, 'success');
  },

  renderInventory(store) {
    const container = document.getElementById('vendor-inventory-list');
    if (!container) return;

    container.innerHTML = store.menu.map(dish => `
      <div class="inventory-item-card">
        <div class="inv-details">
          <div class="inv-title">${dish.name}</div>
          <div class="inv-price">₦${dish.price.toLocaleString()}</div>
        </div>
        <div class="inv-toggle-wrap">
          <div class="toggle-switch ${dish.inStock ? 'on' : ''}" onclick="VendorController.toggleDish('${dish.id}')">
            <div class="toggle-knob"></div>
          </div>
          <span class="inv-stock-label ${dish.inStock ? 'in' : 'out'}">${dish.inStock ? 'In Stock' : 'Sold Out'}</span>
        </div>
      </div>
    `).join('');
  },

  toggleDish(dishId) {
    const store = this.getStore();
    if (!store) return;
    const isStocked = window.chowStore.toggleDishStock(store.id, dishId);
    window.chowApp.toast(`Dish updated to ${isStocked ? 'IN STOCK' : 'SOLD OUT'}`, isStocked ? 'success' : 'warning');
  }
};
