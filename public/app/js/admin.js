/**
 * CHOW45 ADMIN OPERATIONS CENTER CONTROLLER
 * Platform KPIs, real-time order radar & search, vendor verification pipeline,
 * rider oversight, and customer disputes management.
 */

const AdminController = {
  searchQuery: '',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const searchInput = document.getElementById('admin-order-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderOrdersTable(window.chowStore.state.orders);
      });
    }

    window.chowStore.subscribe(() => {
      this.render();
    });

    // Zone active/availability toggles + action buttons (event delegation)
    const zonesList = document.getElementById('admin-zones-list');
    if (zonesList) {
      zonesList.addEventListener('change', (e) => {
        if (!e.target.classList.contains('zone-active-toggle')) return;
        const zone = window.chowStore.updateServiceZone(e.target.dataset.zone, { active: e.target.checked });
        if (zone) window.chowApp.toast(`${zone.name} ${zone.active ? 'activated' : 'deactivated'}`, 'success');
      });
      zonesList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'edit') this.selectZoneForEdit(btn.dataset.zone);
        if (btn.dataset.action === 'add') {
          const zone = window.chowStore.addServiceZone({});
          window.chowApp.toast(`Created ${zone.name} — edit its polygon on the map`, 'success');
        }
      });
    }

    // Ops map: refresh zones after edits are saved
    const mapWrap = document.getElementById('admin-map-canvas');
    if (mapWrap && !mapWrap._chowListener) {
      mapWrap._chowListener = true;
    }
  },

  render() {
    const { orders, restaurants, riders, adminLedger, pendingVendors, disputes } = window.chowStore.state;

    // Platform KPIs
    const activeOrders = orders.filter(o => !['DELIVERED'].includes(o.status));
    const activeRiders = riders.filter(r => r.online);

    const gmvEl = document.getElementById('admin-kpi-gmv');
    if (gmvEl) gmvEl.innerText = formatNaira(adminLedger.totalGmv);

    const feeEl = document.getElementById('admin-kpi-fees');
    if (feeEl) feeEl.innerText = formatNaira(adminLedger.totalServiceFees);

    const activeOrdersEl = document.getElementById('admin-kpi-active-orders');
    if (activeOrdersEl) activeOrdersEl.innerText = activeOrders.length;

    const vendorsCountEl = document.getElementById('admin-kpi-vendors');
    if (vendorsCountEl) vendorsCountEl.innerText = restaurants.length;

    // Render Orders Radar Table
    this.renderOrdersTable(orders);

    // Render Pending Vendor Verifications
    this.renderPendingVendors(pendingVendors);

    // Render Disputes
    this.renderDisputes(disputes || []);

    // Service Areas, Delivery Fees & Operations Map
    this.renderServiceZones();
    this.renderFeeConfig();
    if (!window.chowMap.isReady()) {
      // map labels stay empty until the Mapbox lib has loaded lazily
      if (document.getElementById('admin-map-canvas').getAttribute('data-hint') === null) {
        document.getElementById('admin-map-canvas').setAttribute('data-hint', 'Loading operations map…');
      }
    }
    this.renderOperationsMap();
  },

  renderOrdersTable(orders) {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    let filtered = [...orders];
    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.storeName.toLowerCase().includes(q) ||
        (o.riderName && o.riderName.toLowerCase().includes(q)) ||
        o.status.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--c-text-muted); padding: 24px;">No platform orders match your search.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(order => {
      const stage = ORDER_STAGES[order.status] || { label: order.status };
      const isDelivered = order.status === 'DELIVERED';

      return `
        <tr>
          <td><strong style="font-family: monospace; color: var(--c-primary);">#${order.id}</strong></td>
          <td>${order.customerName}</td>
          <td>${order.storeName}</td>
          <td><strong>${formatNaira(order.total)}</strong> <small style="color: var(--c-text-muted);">(Fee: ${formatNaira(order.serviceFee)})</small></td>
          <td>
            <span class="table-status-tag" style="background: ${isDelivered ? 'var(--c-success-bg)' : 'var(--c-warning-bg)'}; color: ${isDelivered ? '#065F46' : '#92400E'};">
              ${stage.label}
            </span>
          </td>
          <td>${order.riderName || '<span style="color: var(--c-text-muted);">Unassigned</span>'}</td>
        </tr>
      `;
    }).join('');
  },

  renderPendingVendors(pendingVendors) {
    const container = document.getElementById('admin-pending-vendors-list');
    if (!container) return;

    if (pendingVendors.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--c-text-muted); font-size: 0.85rem;">
          No pending vendor applications to verify.
        </div>
      `;
      return;
    }

    container.innerHTML = pendingVendors.map(v => `
      <div style="background: var(--c-bg-subtle); border-radius: var(--radius-lg); padding: 14px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 800; font-size: 0.95rem;">${v.name}</div>
            <div style="font-size: 0.78rem; color: var(--c-text-secondary); margin-bottom: 4px;">Owner: ${v.ownerName || 'Verified Partner'} • ${v.phone}</div>
            <div style="font-size: 0.76rem; color: var(--c-text-muted);">📍 ${v.location} (${v.lga || 'Lagos'}) • Reg: ${v.regNumber || 'CAC-Pending'}</div>
          </div>
          <span class="table-status-tag" style="background: var(--c-warning-bg); color: #92400E;">Pending</span>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 10px;">
          <button class="btn-table-approve" onclick="AdminController.approve('${v.id}')">Approve Store</button>
          <button class="btn-table-reject" onclick="AdminController.rejectPrompt('${v.id}')">Decline</button>
        </div>
      </div>
    `).join('');
  },

  approve(pvId) {
    const v = window.chowStore.state.pendingVendors.find(x => x.id === pvId);
    window.chowStore.approveVendor(pvId);
    if (v && v.applicationId) this._syncVendorDecision(v.applicationId, 'approve');
    window.chowApp.toast('Store verified and published to marketplace!', 'success');
  },

  rejectPrompt(pvId) {
    const reason = prompt('Please enter the reason for rejection (required):', 'Incomplete business registration or food hygiene permit');
    if (reason) {
      const v = window.chowStore.state.pendingVendors.find(x => x.id === pvId);
      window.chowStore.rejectVendor(pvId, reason);
      if (v && v.applicationId) this._syncVendorDecision(v.applicationId, 'reject', reason);
      window.chowApp.toast('Vendor application declined.', 'warning');
    }
  },

  _syncVendorDecision(applicationId, action, reason) {
    if (!applicationId) return;
    fetch(`/api/vendors/${encodeURIComponent(applicationId)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || '' })
    }).catch(() => {
      // Server unreachable — local decision still stands for this session.
    });
  },

  renderDisputes(disputes) {
    const container = document.getElementById('admin-disputes-list');
    if (!container) return;

    if (disputes.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--c-text-muted); font-size: 0.8rem;">No open customer disputes.</div>`;
      return;
    }

    container.innerHTML = disputes.map(d => `
      <div style="background: var(--c-bg-subtle); padding: 10px; border-radius: var(--radius-md); margin-bottom: 8px; font-size: 0.8rem;">
        <div style="display: flex; justify-content: space-between;">
          <strong>Order #${d.orderId}</strong>
          <span style="color: ${d.status === 'open' ? '#DC2626' : '#10B981'}; font-weight: 700;">${d.status.toUpperCase()}</span>
        </div>
        <div>Reason: ${d.reason}</div>
        ${d.status === 'open' ? `
          <button class="btn-table-approve" style="margin-top: 6px; font-size: 0.72rem; padding: 2px 8px;" onclick="AdminController.resolveDispute('${d.id}')">
            Issue ₦ Refund & Close
          </button>
        ` : ''}
      </div>
    `).join('');
  },

  resolveDispute(disputeId) {
    window.chowStore.resolveDispute(disputeId, 'Refund issued to customer wallet');
    window.chowApp.toast('Dispute resolved successfully', 'success');
  },

  // -------------------------------------------------------------
  // Service Areas & Delivery Zones Manager
  // -------------------------------------------------------------
  renderServiceZones() {
    const container = document.getElementById('admin-zones-list');
    if (!container) return;

    const zones = window.chowStore.state.serviceZones || [];
    const activeCount = zones.filter(z => z.active).length;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 0.8rem; color: var(--c-text-muted);">${activeCount} of ${zones.length} zones accepting orders</span>
        <button class="action-btn-primary" data-action="add" style="padding: 6px 14px; font-size: 0.8rem;">＋ Add New Zone</button>
      </div>
      ${zones.map(z => `
        <div class="zone-admin-card">
          <div class="zone-admin-head">
            <div>
              <div class="zone-admin-name">${z.name}</div>
              <div class="zone-admin-meta">${z.state || 'Ogun'} • ${z.lga || 'LGA'} • ${(z.polygon || []).length} boundary points • ${z.center ? `${z.center[1].toFixed(4)}, ${z.center[0].toFixed(4)}` : ''}</div>
            </div>
            <div class="zone-admin-toggle">
              <span>Active</span>
              <input type="checkbox" class="zone-active-toggle" data-zone="${z.id}" ${z.active ? 'checked' : ''} />
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="action-btn-secondary" data-action="edit" data-zone="${z.id}">Edit Boundary on Map</button>
          </div>
        </div>
      `).join('')}
    `;
  },

  renderFeeConfig() {
    const container = document.getElementById('admin-fee-config');
    if (!container) return;

    const c = window.chowStore.state.deliveryConfig || DEFAULT_DELIVERY_FEE_CONFIG;
    container.innerHTML = `
      <div class="fee-config-grid">
        <div class="fee-field"><label>Base Delivery Fee (₦)</label><input id="fee-base" type="number" min="0" value="${c.baseFee}" /></div>
        <div class="fee-field"><label>Service Fee (₦)</label><input id="fee-service" type="number" min="0" value="${c.serviceFee}" /></div>
        <div class="fee-field"><label>Rate per Meter (₦)</label><input id="fee-rate" type="number" step="0.01" min="0" value="${c.ratePerMeter}" /></div>
      </div>
      <div class="fee-config-note">Delivery Fee = Base Fee + (route distance × rate/m). Quoted live per order via the Mapbox Routing API on Ogun State roads.</div>
      <button class="action-btn-primary" onclick="AdminController.saveFeeConfig()">Save Delivery Fee Configuration</button>
    `;
  },

  saveFeeConfig() {
    const baseFee = parseFloat(document.getElementById('fee-base').value) || 0;
    const serviceFee = parseFloat(document.getElementById('fee-service').value) || 0;
    const ratePerMeter = parseFloat(document.getElementById('fee-rate').value) || 0;
    window.chowStore.updateDeliveryConfig({ baseFee, serviceFee, ratePerMeter });
    window.chowApp.toast('Delivery fee configuration saved ✓', 'success');
  },

  zoneEditBannerCleanup() {
    const banner = document.getElementById('zone-edit-banner');
    if (banner) banner.remove();
  },

  async selectZoneForEdit(zoneId) {
    if (!window.chowMap) return;
    const zone = window.chowStore.state.serviceZones.find(z => z.id === zoneId);
    if (!zone) return;

    const containerId = 'admin-map-canvas';
    const map = await window.chowMap.initMap(containerId, {
      initCenter: zone.center || [3.6545, 6.8482],
      zoom: 13,
      onLoad: () => window.chowMap.clearRoute(containerId)
    });
    if (!map) return;

    this.zoneEditBannerCleanup();
    const banner = document.createElement('div');
    banner.id = 'zone-edit-banner';
    banner.innerHTML = `
      <span><strong>Editing:</strong> ${zone.name} — drag the numbered pins, then save.</span>
      <button data-edit-save>Save Polygon</button>
      <button data-edit-done>Done</button>
    `;
    document.querySelector('.admin-map-wrap').appendChild(banner);

    const vertexMarkers = window.chowMap.renderZonePolygonEditor(containerId, zone, (updated) => {
      window.chowMap.drawZonePolygon(map, updated.polygon);
    });

    banner.querySelector('[data-edit-save]').onclick = () => {
      window.chowStore.updateServiceZone(zoneId, { polygon: JSON.parse(JSON.stringify(zone.polygon)) });
      window.chowApp.toast('Zone boundary updated ✓', 'success');
      this.zoneEditBannerCleanup();
      this.renderOperationsMap();
    };
    banner.querySelector('[data-edit-done]').onclick = () => this.zoneEditBannerCleanup();
  },

  async renderOperationsMap() {
    const canvas = document.getElementById('admin-map-canvas');
    if (!canvas) return;
    if (!window.chowMap) return;
    if (this._opsMapLoading) return;
    this._opsMapLoading = true;

    try {
      const map = await window.chowMap.initMap('admin-map-canvas', {
        initCenter: [3.6545, 6.8482],
        zoom: 10.5,
        onLoad: () => window.chowMap.clearRoute('admin-map-canvas')
      });
      if (!map) return;

      if (!map.isStyleLoaded()) {
        map.once('style.load', () => {
          this._opsMapLoading = false;
          this.renderOperationsMap();
        });
        return;
      }

      const zones = window.chowStore.state.serviceZones || [];
      const features = zones
        .filter(z => z.polygon && z.polygon.length >= 3)
        .map(z => ({
          type: 'Feature',
          properties: { id: z.id, name: z.name, active: z.active },
          geometry: { type: 'Polygon', coordinates: [z.polygon] }
        }));

      if (features.length) {
        if (!map.getSource('admin-zones')) {
          map.addSource('admin-zones', { type: 'geojson', data: { type: 'FeatureCollection', features } });
          map.addLayer({
            id: 'admin-zones-fill', type: 'fill', source: 'admin-zones',
            paint: { 'fill-color': '#0C513F', 'fill-opacity': 0.14 }
          });
          map.addLayer({
            id: 'admin-zones-line', type: 'line', source: 'admin-zones',
            paint: { 'line-color': '#0C513F', 'line-width': 2, 'line-dasharray': [2.5, 1.5] }
          });
        } else {
          map.getSource('admin-zones').setData({ type: 'FeatureCollection', features });
        }
      }

      // Vendor + rider operational markers
      const state = window.chowStore.state;
      (state.restaurants || []).forEach(store => {
        if (store.lng == null) return;
        window.chowMap.addMarker(map, 'store', { lng: store.lng, lat: store.lat }, {
          popupHtml: `<strong>${store.name}</strong><br><small>${store.cuisine || ''} • ${store.lga || ''}</small>`
        });
      });
      (state.riders || []).forEach(r => {
        if (r.currentLng == null) return;
        window.chowMap.addMarker(map, 'rider', { lng: r.currentLng, lat: r.currentLat }, {
          popupHtml: `<strong>${r.name}</strong><br><small>${r.online ? 'Online' : 'Offline'} • ${r.vehicle || 'Bike'}</small>`
        });
      });

      canvas.removeAttribute('data-hint');
    } catch (err) {
      console.warn('Admin ops map failed to initialize:', err);
    } finally {
      this._opsMapLoading = false;
    }
  }
};

window.AdminController = AdminController;
