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
    this.startLocationTracking();
  },

   startLocationTracking(){
    navigator.geolocation.watchPosition(
      (position) => {this.latestposition = position.coords},
      (error) => console.error("GPS error:", error),
      {enableHighAccuracy: true}
    );

    setInterval(()=> {
      if(!this.latestposition) return;
      if (!this.activeOrder) return;

      fetch(`/api/riders/${this.currentRiderId}`,{
        method: 'PATCH',
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ lat: this.latestposition.latitude, lng: this.latestposition.longitude})
      });
    }, 8000);
  },

  bindEvents() {
    window.chowStore.subscribe(() => {
      this.render();
    });

    const pinInput = document.getElementById('rider-modal-pin');
    if (pinInput) {
      pinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitPinAndComplete();
        }
      });
      pinInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        const err = document.getElementById('rider-pin-modal-error');
        if (err) err.style.display = 'none';
        if (val.length === 4) {
          setTimeout(() => this.submitPinAndComplete(), 150);
        }
      });
    }
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
            <span class="distance-badge">${order.routeDistanceMeters ? formatDistanceMeters(order.routeDistanceMeters) : (`~${store.distanceKm || 1.8} km`)}</span>
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
                <div class="stop-title">Customer near ${order.deliveryAddress ? order.deliveryAddress.split(',')[0] : 'Delivery Area'}</div>
                <div class="stop-address">${(order.items || []).length} item(s) • Total order ${formatNaira(order.total)}</div>
              </div>
            </div>
          </div>

          <button class="accept-job-btn" onclick="RiderController.acceptJob('${order.id}')">
            Accept Delivery (Earn ${formatNaira(payout)})
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
    const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId) || {};

    const orderIdEl = document.getElementById('mission-order-id');
    if (orderIdEl) orderIdEl.innerText = `#${order.id}`;

    // 1. Pickup Vendor Details (Name, Address, Call)
    const storeNameEl = document.getElementById('mission-store-name');
    if (storeNameEl) storeNameEl.innerText = order.storeName;

    const storeAddrEl = document.getElementById('mission-store-addr');
    if (storeAddrEl) {
      storeAddrEl.innerText = store.address || 'Vendor Pickup Location, Ogun State';
    }

    const storePhoneLink = document.getElementById('mission-store-phone-link');
    if (storePhoneLink) {
      const storePhone = store.phone || '+234 802 331 4492';
      storePhoneLink.href = `tel:${storePhone}`;
      storePhoneLink.title = `Call ${order.storeName}`;
    }

    // 2. Delivery Destination Details (Customer Name, Destination Address, Phone, Notes)
    const custInfoEl = document.getElementById('mission-customer-info');
    if (custInfoEl) custInfoEl.innerText = `${order.customerName} (${order.customerPhone || 'Customer'})`;

    const dropoffAddrEl = document.getElementById('mission-dropoff-addr');
    if (dropoffAddrEl) dropoffAddrEl.innerText = order.deliveryAddress;

    const custPhoneLink = document.getElementById('mission-customer-phone-link');
    if (custPhoneLink) {
      custPhoneLink.href = order.customerPhone ? `tel:${order.customerPhone}` : '#';
      custPhoneLink.title = `Call ${order.customerName}`;
    }

    const notesBox = document.getElementById('mission-delivery-notes-box');
    const notesText = document.getElementById('mission-delivery-notes-text');
    if (notesBox && notesText) {
      if (order.deliveryNotes) {
        notesText.innerText = order.deliveryNotes;
        notesBox.style.display = 'flex';
      } else {
        notesBox.style.display = 'none';
      }
    }

    // 3. Customer Order Manifest (What the person ordered)
    const itemsListEl = document.getElementById('mission-items-manifest-list');
    const itemsBadgeEl = document.getElementById('mission-items-count-badge');
    if (itemsBadgeEl) itemsBadgeEl.innerText = `${order.items ? order.items.length : 0} items`;

    if (itemsListEl && Array.isArray(order.items)) {
      itemsListEl.innerHTML = order.items.map(item => {
        const addons = (item.selectedAddons && item.selectedAddons.length > 0)
          ? item.selectedAddons.map(a => `+ ${a.name} (+₦${(Number(a.price) || 0).toLocaleString()})`).join(', ')
          : '';
        const itemPrice = (Number(item.unitPrice) || Number(item.price) || 0) * (item.qty || 1);
        return `
          <div class="mission-manifest-item">
            <div class="mission-manifest-item-main">
              <span class="mission-manifest-item-qty">${item.qty}x</span>
              <div class="mission-manifest-item-text">
                <div class="mission-manifest-item-name">${item.name}</div>
                ${addons ? `<div class="mission-manifest-item-addons">${addons}</div>` : ''}
              </div>
            </div>
            <div class="mission-manifest-item-price">₦${itemPrice.toLocaleString()}</div>
          </div>
        `;
      }).join('');
    }

    const totalValEl = document.getElementById('mission-total-val');
    if (totalValEl) totalValEl.innerText = `Total: ₦${(order.total || 0).toLocaleString()}`;

    const payStatusEl = document.getElementById('mission-payment-status');
    if (payStatusEl) {
      payStatusEl.innerText = order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online ✓';
    }

    const metrics = this.renderMissionStats(order);

    const actionContainer = document.getElementById('mission-action-container');
    if (!actionContainer) return;

    if (status === 'RIDER_ASSIGNED' || status === 'RIDER_HEADING_TO_STORE') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge">Phase 1: Navigate to Store</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 12px;">Head to <strong>${order.storeName}</strong> to pick up the order.</p>
        <button class="mission-step-btn" onclick="RiderController.advanceMission('RIDER_AT_STORE')">
          📍 I've Arrived at the Restaurant
        </button>
      `;
    } else if (status === 'RIDER_AT_STORE') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge">Phase 1: Pickup Verification</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 8px;">Check that all items are packed:</p>
        <div style="background: var(--c-bg-subtle); padding: 10px 14px; border-radius: var(--radius-md); margin-bottom: 12px; font-size: 0.85rem;">
          ${order.items.map(i => `<div>✓ ${i.qty}x ${i.name}</div>`).join('')}
        </div>
        <button class="mission-step-btn" onclick="RiderController.advanceMission('PICKED_UP')">
          🛍️ I've Picked Up the Order
        </button>
      `;
    } else if (status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY' || status === 'RIDER_NEARBY') {
      actionContainer.innerHTML = `
        <div class="mission-phase-badge" style="background: var(--c-secondary-soft); color: var(--c-secondary);">Phase 2: Delivering to Customer</div>
        <p style="font-size: 0.85rem; color: var(--c-text-secondary); margin: 6px 0 12px;">
          Deliver to: <strong>${order.customerName}</strong> at <strong>${order.deliveryAddress}</strong>
        </p>
        <button class="mission-step-btn" style="background: #10B981; margin-bottom: 8px;" onclick="RiderController.openPinModal('${order.id}')">
          ✅ Complete Delivery
        </button>
      `;
    }

    // Mapbox navigation helper available on every phase
    const navBtn = document.createElement('button');
    navBtn.className = 'mission-nav-btn';
    navBtn.innerHTML = '🧭 Start Turn-by-Turn Navigation';
    navBtn.onclick = () => this.renderMissionRoute(order.id);
    actionContainer.appendChild(navBtn);
  },

  computeMissionMetrics(order) {
    const store = window.chowStore.state.restaurants.find(r => r.id === order.storeId) || {};
    const dest = order.deliveryLocation || window.chowStore.state.selectedLocation || {};
    const o = { lng: store.lng ?? store.longitude ?? 3.6530, lat: store.lat ?? store.latitude ?? 6.8475 };
    const d = { lng: dest.longitude ?? dest.lng ?? 3.6545, lat: dest.latitude ?? dest.lat ?? 6.8482 };
    const distanceMeters = order.routeDistanceMeters || haversineDistanceMeters(o, d);
    const durationSeconds = order.estimatedDurationSeconds || null;
    const payout = order.deliveryFee || 800;
    return { store, o, d, distanceMeters, durationSeconds, payout };
  },

  renderMissionStats(order) {
    const metrics = this.computeMissionMetrics(order);
    const distEl = document.getElementById('mission-distance');
    const etaEl = document.getElementById('mission-eta');
    const payEl = document.getElementById('mission-payout');
    if (distEl) distEl.innerText = formatDistanceMeters(metrics.distanceMeters);
    if (etaEl) etaEl.innerText = metrics.durationSeconds ? formatDurationSeconds(metrics.durationSeconds) : '—';
    if (payEl) payEl.innerText = `₦${metrics.payout.toLocaleString()}`;
    return metrics;
  },

  async renderMissionRoute(orderId) {
    if (!window.chowMap) return;
    const order = window.chowStore.state.orders.find(o => o.id === orderId);
    if (!order) return;

    const metrics = this.computeMissionMetrics(order);
    const containerId = 'rider-map-canvas';
    const canvas = document.getElementById(containerId);
    if (!canvas) return;

    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const map = await window.chowMap.initMap(containerId, {
      initCenter: [metrics.d.lng, metrics.d.lat],
      zoom: 13,
      onLoad: () => window.chowMap.clearRoute(containerId)
    });
    if (!map) return;

    const route = await window.chowMap.getDirections(metrics.o, metrics.d);
    if (route && route.geometry) {
      window.chowMap.drawRoute(containerId, route.geometry);
      const bounds = new mapboxgl.LngLatBounds()
        .extend([metrics.o.lng, metrics.o.lat])
        .extend([metrics.d.lng, metrics.d.lat]);
      map.fitBounds(bounds, { padding: 70, duration: 600 });
    }

    window.chowMap.addMarker(map, 'store', metrics.o, {
      popupHtml: `<strong>${order.storeName}</strong><br><small>Pickup Point</small>`
    });
    window.chowMap.addMarker(map, 'customer', metrics.d, {
      popupHtml: `<strong>${order.customerName}</strong><br><small>${order.deliveryAddress}</small>`
    });

    const rider = this.getRider();
    if (rider) {
      window.chowMap.addMarker(map, 'rider', {
        lng: rider.currentLng ?? metrics.o.lng,
        lat: rider.currentLat ?? metrics.o.lat
      });
    }

    window.chowApp.toast('Navigation route loaded — follow the highlighted road', 'success');
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

  openPinModal(orderId) {
    this.pendingCompletionOrderId = orderId;
    const modal = document.getElementById('rider-pin-modal');
    if (!modal) return;
    const input = document.getElementById('rider-modal-pin');
    const err = document.getElementById('rider-pin-modal-error');
    if (input) {
      input.value = '';
    }
    if (err) err.style.display = 'none';
    modal.classList.add('open');
    if (input) setTimeout(() => input.focus(), 150);
  },

  closePinModal() {
    const modal = document.getElementById('rider-pin-modal');
    if (modal) modal.classList.remove('open');
    this.pendingCompletionOrderId = null;
  },

  async submitPinAndComplete() {
    const orderId = this.pendingCompletionOrderId || (this.activeOrder ? this.activeOrder.id : null);
    if (!orderId || !this.activeOrder) return;

    const input = document.getElementById('rider-modal-pin');
    const errEl = document.getElementById('rider-pin-modal-error');
    const enteredPin = input ? input.value.trim() : '';

    if (!enteredPin || enteredPin.length !== 4) {
      if (errEl) {
        errEl.innerText = 'Please enter the complete 4-digit security PIN.';
        errEl.style.display = 'block';
      }
      return;
    }

    // Call server PIN verification endpoint
    try {
      const res = await fetch(`/api/orders/${orderId}/verify-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (errEl) {
          errEl.innerText = data.error || 'Incorrect PIN code! Please ask the customer for their 4-digit code.';
          errEl.style.display = 'block';
        }
        if (input) {
          input.value = '';
          input.focus();
        }
        return;
      }
    } catch (e) {
      // Local check fallback in offline/demo environment
      if (enteredPin !== String(this.activeOrder.pin)) {
        if (errEl) {
          errEl.innerText = 'Incorrect PIN code! Please ask the customer for their 4-digit code.';
          errEl.style.display = 'block';
        }
        if (input) {
          input.value = '';
          input.focus();
        }
        return;
      }
    }

    // Success!
    this.closePinModal();
    const rider = this.getRider();
    window.chowStore.advanceOrderStatus(orderId, 'DELIVERED', {
      riderId: rider.id,
      riderName: rider.name
    });

    const fee = this.activeOrder.deliveryFee || 800;
    window.chowApp.toast(`Delivery #${orderId} completed! ₦${fee.toLocaleString()} added to your wallet 💰`, 'success');
  },

  toggleOnlineStatus() {
    const rider = this.getRider();
    if (!rider) return;
    rider.online = !rider.online;

    const headerDuty = document.getElementById('rider-header-duty-toggle');
    const headerText = document.getElementById('rider-duty-text');
    const cardToggle = document.querySelector('.rider-online-toggle');

    if (rider.online) {
      if (headerDuty) {
        headerDuty.classList.remove('offline');
        headerDuty.classList.add('online');
      }
      if (headerText) headerText.innerText = 'On Duty';
      if (cardToggle) {
        cardToggle.classList.remove('offline');
        cardToggle.classList.add('online');
        cardToggle.innerHTML = '<span class="radar-pulse-dot"></span><span>ONLINE & READY</span>';
      }
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('You are now ONLINE. Campus deliveries will appear on your radar.', 'success');
      }
    } else {
      if (headerDuty) {
        headerDuty.classList.remove('online');
        headerDuty.classList.add('offline');
      }
      if (headerText) headerText.innerText = 'Off Duty';
      if (cardToggle) {
        cardToggle.classList.remove('online');
        cardToggle.classList.add('offline');
        cardToggle.innerHTML = '<span class="radar-pulse-dot offline"></span><span>OFFLINE</span>';
      }
      if (window.chowApp && window.chowApp.toast) {
        window.chowApp.toast('You are now OFFLINE. Radar is paused.', 'info');
      }
    }
  }
};

window.RiderController = RiderController;
