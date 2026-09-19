/**
 * CHOW45 RIDER PORTAL CONTROLLER
 * Live delivery radar, turn-by-turn simulation, pickup & 4-digit drop-off PIN
 */

const RiderController = {
  currentRiderId: 'rider-1',
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

    // Check if rider has active in-progress order
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

    // Daily earnings
    const completed = window.chowStore.state.orders.filter(o => o.riderId === rider.id && o.status === 'DELIVERED');
    const earnings = completed.reduce((sum, o) => sum + (o.deliveryFee || 500), 0);
    const earnEl = document.getElementById('rider-earnings-val');
    if (earnEl) earnEl.innerText = `₦${earnings.toLocaleString()}`;
    const tripsEl = document.getElementById('rider-trips-count');
    if (tripsEl) tripsEl.innerText = completed.length;

    // View Switching: Active mission vs Radar feed
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

    // Available jobs are orders without a rider assigned that are confirmed or ready
    const availableOrders = window.chowStore.state.orders.filter(o =>
      !o.riderId && !['DELIVERED', 'PENDING_PAYMENT'].includes(o.status)
    );

    if (availableOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; background: white; border-radius: var(--radius-xl); border: 1px dashed var(--c-border);">
          <div style="font-size: 2rem; margin-bottom: 8px;">📡</div>
          <h4 style="font-family: var(--font-display); font-size: 1.1rem; margin-bottom: 4px;">Searching for nearby deliveries...</h4>
          <p style="color: var(--c-text-secondary); font-size: 0.85rem;">You are online in the Sagamu/OOU dispatch zone. New orders will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = availableOrders.map(order => {
      const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId) || {};
      const payout = order.deliveryFee || 500;

      return `
        <div class="job-card">
          <div class="job-payout-row">
            <div>
              <span class="payout-tag">₦${payout.toLocaleString()}</span>
              <span style="font-size: 0.75rem; color: var(--c-text-muted); margin-left: 4px;">Rider Payout</span>
            </div>
            <span class="distance-badge">~${store.distanceKm || 1.5} km distance</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; margin: 4px 0;">
            <div class="route-stop-line">
              <span class="stop-icon stop-pickup">P</span>
              <div class="stop-details">
                <div class="stop-title">${order.storeName}</div>
                <div class="stop-address">${store.address || 'Sagamu Campus Zone'}</div>
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

    window.chowApp.toast(`Accepted delivery ${orderId}! Head towards the restaurant.`, 'success');
  },

  renderActiveMission(order) {
    const status = order.status;
    const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId) || {};

    document.getElementById('mission-order-id').innerText = order.id;
    document.getElementById('mission-store-name').innerText = order.storeName;
    document.getElementById('mission-customer-info').innerText = `${order.customerName} (${order.customerPhone})`;
    document.getElementById('mission-dropoff-addr').innerText = order.deliveryAddress;
    document.getElementById('mission-expected-pin').innerText = order.pin;

    const actionContainer = document.getElementById('mission-action-container');
    if (!actionContainer) return;

    if (status === 'RIDER_ASSIGNED') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge">Phase 1: Ride to Restaurant</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 12px;">Head to ${order.storeName} to pick up the package.</p>
        <button class="mission-step-btn" onclick="RiderController.advanceMission('RIDER_AT_STORE')">
          📍 I Have Arrived at Restaurant
        </button>
      `;
    } else if (status === 'RIDER_AT_STORE') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge">Phase 1: Collection</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 12px;">Verify meal packaging and thermal seal.</p>
        <button class="mission-step-btn" onclick="RiderController.advanceMission('PICKED_UP')">
          🛍️ Confirm Food Picked Up
        </button>
      `;
    } else if (status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge" style="background: var(--c-secondary-soft); color: var(--c-secondary);">Phase 2: En Route to Customer</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 12px;">Deliver to: <strong>${order.deliveryAddress}</strong></p>
        <div style="background: var(--c-bg-subtle); padding: 12px; border-radius: var(--radius-md); margin-bottom: 12px;">
          <label style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 6px;">Ask Customer for 4-Digit Delivery PIN:</label>
          <input type="text" id="rider-pin-input" maxlength="4" placeholder="e.g. 4591" style="font-family: monospace; font-size: 1.2rem; font-weight: 800; letter-spacing: 4px; text-align: center; width: 100%; padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--c-border);" />
        </div>
        <button class="mission-step-btn" style="background: #10B981;" onclick="RiderController.completeDeliveryWithPin('${order.id}')">
          ✅ Verify PIN & Complete Delivery
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
      window.chowApp.toast(`Incorrect PIN! Customer's PIN is ${this.activeOrder.pin} (demo mode)`, 'error');
      return;
    }

    const rider = this.getRider();
    window.chowStore.advanceOrderStatus(orderId, 'DELIVERED', {
      riderId: rider.id,
      riderName: rider.name
    });

    window.chowApp.toast(`Delivery completed successfully! ₦${(this.activeOrder.deliveryFee || 500).toLocaleString()} credited to your wallet 💰`, 'success');
  }
};
