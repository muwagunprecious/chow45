/**
 * CHOW45 RIDER PORTAL CONTROLLER
 * Live delivery radar, turn-by-turn simulation, pickup checklist & 4-digit drop-off PIN
 */

const RiderController = {
  currentRiderId: 'rider-david',
  activeOrder: null,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    window.chowStore.subscribe(() => {
      this.render();
    });
  },

  getRider() {
    return window.chowStore.state.riders.find(r => r.id === this.currentRiderId) || window.chowStore.state.riders[0];
  },

  render() {
    const rider = this.getRider();
    if (!rider) return;

    this.activeOrder = window.chowStore.state.orders.find(o =>
      o.riderId === rider.id && !['DELIVERED'].includes(o.status)
    );

    // Profile card
    const name = document.getElementById('rider-profile-name');
    if (name) name.innerText = rider.name;
    const vehicle = document.getElementById('rider-profile-vehicle');
    if (vehicle) vehicle.innerText = rider.vehicle;
    const avatar = document.getElementById('rider-profile-avatar');
    if (avatar) avatar.src = rider.avatar;

    // Daily earnings & completed drops
    const completed = window.chowStore.state.orders.filter(o => o.riderId === rider.id && o.status === 'DELIVERED');
    const earnings = completed.reduce((sum, o) => sum + (o.deliveryFee || 800), 0);
    const earnEl = document.getElementById('rider-earnings-val');
    if (earnEl) earnEl.innerText = `₦${earnings.toLocaleString()}`;
    const tripsEl = document.getElementById('rider-trips-count');
    if (tripsEl) tripsEl.innerText = completed.length;

    // View Switching
    const missionSec = document.getElementById('rider-active-mission-section');
    const radarSec = document.getElementById('rider-radar-feed-section');

    if (this.activeOrder) {
      if (missionSec) missionSec.style.display = 'block';
      if (radarSec) radarSec.style.display = 'none';
      this.renderActiveMission(this.activeOrder);
    } else {
      if (missionSec) missionSec.style.display = 'none';
      if (radarSec) radarSec.style.display = 'block';
      this.renderRadarFeed();
    }
  },

  renderRadarFeed() {
    const container = document.getElementById('rider-jobs-feed');
    if (!container) return;

    const availableOrders = window.chowStore.state.orders.filter(o =>
      !o.riderId && !['DELIVERED', 'PENDING_PAYMENT'].includes(o.status)
    );

    if (availableOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; background: white; border-radius: var(--radius-xl); border: 1px dashed var(--c-border);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📡</div>
          <h4 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 800; margin-bottom: 4px;">Searching for nearby deliveries...</h4>
          <p style="color: var(--c-text-secondary); font-size: 0.85rem;">You are online in the Idimu / Lagos dispatch zone. New orders will appear here in real-time.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = availableOrders.map(order => {
      const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId) || {};
      const payout = order.deliveryFee || 800;

      return `
        <div class="job-card">
          <div class="job-payout-row">
            <div>
              <span class="payout-tag">₦${payout.toLocaleString()}</span>
              <span style="font-size: 0.75rem; color: var(--c-text-muted); margin-left: 4px;">Estimated Payout</span>
            </div>
            <span class="distance-badge">~${store.distanceKm || 1.8} km</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; margin: 6px 0;">
            <div class="route-stop-line">
              <span class="stop-icon stop-pickup">P</span>
              <div class="stop-details">
                <div class="stop-title">${order.storeName}</div>
                <div class="stop-address">${store.address || 'Idimu, Lagos'}</div>
              </div>
            </div>
            <div class="route-stop-line">
              <span class="stop-icon stop-dropoff">D</span>
              <div class="stop-details">
                <div class="stop-title">${order.customerName} (${order.deliveryAddress})</div>
                <div class="stop-address">${order.items.length} item(s) • Total order ₦${order.total.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <button class="accept-job-btn" onclick="RiderController.acceptJob('${order.id}')">
            Accept Delivery (Earn ₦${payout.toLocaleString()})
          </button>
        </div>
      `;
    }).join('');
  },

  acceptJob(orderId) {
    const rider = this.getRider();
    window.chowStore.advanceOrderStatus(orderId, 'RIDER_ASSIGNED', {
      riderId: rider.id,
      riderName: rider.name
    });

    window.chowApp.toast(`Accepted delivery #${orderId}! Navigate to restaurant.`, 'success');
  },

  renderActiveMission(order) {
    const status = order.status;

    document.getElementById('mission-order-id').innerText = `#${order.id}`;
    document.getElementById('mission-store-name').innerText = order.storeName;
    document.getElementById('mission-customer-info').innerText = `${order.customerName} (${order.customerPhone})`;
    document.getElementById('mission-dropoff-addr').innerText = order.deliveryAddress;
    document.getElementById('mission-expected-pin').innerText = order.pin;

    const actionContainer = document.getElementById('mission-action-container');
    if (!actionContainer) return;

    if (status === 'RIDER_ASSIGNED' || status === 'RIDER_HEADING_TO_STORE') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge">Phase 1: Navigate to Store</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 12px;">Head to <strong>${order.storeName}</strong> to pick up the meal.</p>
        <button class="mission-step-btn" onclick="RiderController.advanceMission('RIDER_AT_STORE')">
          📍 I've Arrived at the Restaurant
        </button>
      `;
    } else if (status === 'RIDER_AT_STORE') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge">Phase 1: Pickup Checklist</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 8px;">Verify thermal seal & items:</p>
        <div style="background: var(--c-bg-canvas); padding: 8px 12px; border-radius: var(--radius-md); margin-bottom: 12px; font-size: 0.85rem;">
          ${order.items.map(i => `<div>✓ ${i.qty}x ${i.name}</div>`).join('')}
        </div>
        <button class="mission-step-btn" onclick="RiderController.advanceMission('PICKED_UP')">
          🛍️ I've Picked Up the Order
        </button>
      `;
    } else if (status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY' || status === 'RIDER_NEARBY') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge" style="background: var(--c-secondary-soft); color: var(--c-secondary);">Phase 2: Navigate to Customer</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 12px;">Deliver to: <strong>${order.deliveryAddress}</strong></p>
        <div style="background: var(--c-bg-subtle); padding: 12px; border-radius: var(--radius-md); margin-bottom: 12px;">
          <label style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 6px;">Ask Customer for 4-Digit Delivery PIN:</label>
          <input type="text" id="rider-pin-input" maxlength="4" placeholder="e.g. ${order.pin}" style="font-family: monospace; font-size: 1.25rem; font-weight: 800; letter-spacing: 4px; text-align: center; width: 100%; padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--c-border);" />
        </div>
        <button class="mission-step-btn" style="background: #10B981;" onclick="RiderController.completeDeliveryWithPin('${order.id}')">
          ✅ I've Delivered the Order
        </button>
      `;
    }
  },

  advanceMission(nextStatus) {
    if (!this.activeOrder) return;
    const rider = this.getRider();
    window.chowStore.advanceOrderStatus(this.activeOrder.id, nextStatus, {
      riderId: rider.id,
      riderName: rider.name
    });
    window.chowApp.toast(`Status updated: ${ORDER_STAGES[nextStatus]?.label}`, 'success');
  },

  completeDeliveryWithPin(orderId) {
    const input = document.getElementById('rider-pin-input');
    const enteredPin = input ? input.value.trim() : '';

    if (!enteredPin || enteredPin !== this.activeOrder.pin) {
      window.chowApp.toast(`Incorrect PIN! Please ask customer for code: ${this.activeOrder.pin}`, 'error');
      return;
    }

    const rider = this.getRider();
    window.chowStore.advanceOrderStatus(orderId, 'DELIVERED', {
      riderId: rider.id,
      riderName: rider.name
    });

    window.chowApp.toast(`Delivery completed! ₦${(this.activeOrder.deliveryFee || 800).toLocaleString()} added to your wallet 💰`, 'success');
  }
};
