/**
 * CHOW45 ADMIN OPERATIONS CENTER CONTROLLER
 * Platform KPIs, real-time order radar, vendor verification, and fee ledger
 */

const AdminController = {
  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    window.chowStore.subscribe(() => {
      this.render();
    });
  },

  render() {
    const { orders, restaurants, riders, adminLedger, pendingVendors } = window.chowStore.state;

    // Platform KPIs
    const activeOrders = orders.filter(o => !['DELIVERED'].includes(o.status));
    const activeRiders = riders.filter(r => r.online);

    const gmvEl = document.getElementById('admin-kpi-gmv');
    if (gmvEl) gmvEl.innerText = `₦${adminLedger.totalGmv.toLocaleString()}`;

    const feeEl = document.getElementById('admin-kpi-fees');
    if (feeEl) feeEl.innerText = `₦${adminLedger.totalServiceFees.toLocaleString()}`;

    const activeOrdersEl = document.getElementById('admin-kpi-active-orders');
    if (activeOrdersEl) activeOrdersEl.innerText = activeOrders.length;

    const vendorsCountEl = document.getElementById('admin-kpi-vendors');
    if (vendorsCountEl) vendorsCountEl.innerText = restaurants.length;

    // Render Orders Radar Table
    this.renderOrdersTable(orders);

    // Render Pending Vendor Verifications
    this.renderPendingVendors(pendingVendors);
  },

  renderOrdersTable(orders) {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--c-text-muted); padding: 24px;">No platform orders yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const stage = ORDER_STAGES[order.status] || { label: order.status };
      const isDelivered = order.status === 'DELIVERED';

      return `
        <tr>
          <td><strong style="font-family: monospace; color: var(--c-primary);">${order.id}</strong></td>
          <td>${order.customerName}</td>
          <td>${order.storeName}</td>
          <td><strong>₦${order.total.toLocaleString()}</strong> <small style="color: var(--c-text-muted);">(Fee: ₦${order.serviceFee})</small></td>
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
        <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 2px;">${v.name}</div>
        <div style="font-size: 0.78rem; color: var(--c-text-secondary); margin-bottom: 6px;">📍 ${v.location} • Specialty: ${v.cuisine}</div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn-table-approve" onclick="AdminController.approve('${v.id}')">Approve & Publish</button>
          <button class="btn-table-reject" onclick="AdminController.reject('${v.id}')">Reject</button>
        </div>
      </div>
    `).join('');
  },

  approve(pvId) {
    window.chowStore.approveVendor(pvId);
    window.chowApp.toast('Vendor approved and instantly published to marketplace!', 'success');
  },

  reject(pvId) {
    window.chowStore.rejectVendor(pvId);
    window.chowApp.toast('Vendor application declined.', 'warning');
  }
};
