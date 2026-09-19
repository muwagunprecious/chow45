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
  },

  render() {
    const { orders, restaurants, riders, adminLedger, pendingVendors, disputes } = window.chowStore.state;

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

    // Render Disputes
    this.renderDisputes(disputes || []);
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
    window.chowStore.approveVendor(pvId);
    window.chowApp.toast('Store verified and published to marketplace!', 'success');
  },

  rejectPrompt(pvId) {
    const reason = prompt('Please enter the reason for rejection (required):', 'Incomplete business registration or food hygiene permit');
    if (reason) {
      window.chowStore.rejectVendor(pvId, reason);
      window.chowApp.toast('Vendor application declined.', 'warning');
    }
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
  }
};
