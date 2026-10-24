const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/vendor.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

// 1. Update _orderBuckets
const target1 = `  _orderBuckets(storeOrders) {
    const list = Array.isArray(storeOrders) ? storeOrders : [];
    return {
      new: list.filter(o => o.status === 'PAID'),
      preparing: list.filter(o => o.status === 'RESTAURANT_ACCEPTED' || o.status === 'PREPARING'),
      complete: list.filter(o => o.status === 'READY_FOR_PICKUP' || o.status === 'RIDER_ASSIGNED' || o.status === 'RIDER_HEADING_TO_STORE' || o.status === 'RIDER_AT_STORE' || o.status === 'PICKED_UP' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'RIDER_NEARBY' || o.status === 'DELIVERED')
    };
  },`;

const repl1 = `  _orderBuckets(storeOrders) {
    const list = Array.isArray(storeOrders) ? storeOrders : [];
    return {
      new: list.filter(o => o.status === 'PAID'),
      preparing: list.filter(o => o.status === 'RESTAURANT_ACCEPTED' || o.status === 'PREPARING'),
      preorders: list.filter(o => Boolean(o.isPreorder)),
      complete: list.filter(o => o.status === 'READY_FOR_PICKUP' || o.status === 'RIDER_ASSIGNED' || o.status === 'RIDER_HEADING_TO_STORE' || o.status === 'RIDER_AT_STORE' || o.status === 'PICKED_UP' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'RIDER_NEARBY' || o.status === 'DELIVERED')
    };
  },`;

// 2. Update renderKitchenOrders counts & messages
const target2 = `    const prepCount = document.getElementById('vendor-count-preparing');
    if (prepCount) prepCount.innerText = buckets.preparing.length;`;

const repl2 = `    const prepCount = document.getElementById('vendor-count-preparing');
    if (prepCount) prepCount.innerText = buckets.preparing.length;
    const preCount = document.getElementById('vendor-count-preorders');
    if (preCount) preCount.innerText = buckets.preorders.length;`;

const target3 = `      const messages = {
        new: 'You have no new orders right now',
        preparing: 'Nothing in the kitchen at the moment',
        complete: 'Completed and in-transit orders will appear here'
      };`;

const repl3 = `      const messages = {
        new: 'You have no new orders right now',
        preparing: 'Nothing in the kitchen at the moment',
        preorders: 'You have no scheduled pre-orders at the moment',
        complete: 'Completed and in-transit orders will appear here'
      };`;

// 3. Update _orderCard with pre-order panel and badge
const target4 = `            <span style="font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #0C513F; background: #ECFDF5; padding: 3px 8px; border-radius: 6px;">CHOW45 KITCHEN RECEIPT</span>`;

const repl4 = `            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #0C513F; background: #ECFDF5; padding: 3px 8px; border-radius: 6px;">CHOW45 KITCHEN RECEIPT</span>
              \${order.isPreorder ? '<span style="font-size: 0.72rem; font-weight: 800; color: #92400E; background: #FEF3C7; padding: 3px 8px; border-radius: 6px; border: 1px solid #FDE68A;">🗓️ PRE-ORDER</span>' : ''}
            </div>`;

const target5 = `        <div class="vnd-order-items" style="margin-bottom: 12px;">\${itemsHtml}</div>`;

const repl5 = '        ' + [
  '${order.isPreorder ? `',
  '        <!-- Pre-Order Kitchen Schedule & Readiness Panel -->',
  '        <div class="vnd-preorder-panel" style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 14px; padding: 14px 16px; margin: 12px 0;">',
  '          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">',
  '            <span style="font-size: 0.76rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #92400E; display: inline-flex; align-items: center; gap: 4px;">',
  '              🗓️ PRE-ORDER DELIVERY SCHEDULE',
  '            </span>',
  '            <span style="font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: ${order.isFoodReady ? "#DCFCE7" : "#FEF3C7"}; color: ${order.isFoodReady ? "#15803D" : "#B45309"}; border: 1px solid ${order.isFoodReady ? "#86EFAC" : "#FDE68A"};">',
  '              ${order.isFoodReady ? "✅ Food Ready for Pickup" : "⏳ Scheduled"}',
  '            </span>',
  '          </div>',
  '          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">',
  '            <div>',
  '              <label for="vnd-pre-date-${order.id}" style="display: block; font-size: 0.72rem; font-weight: 700; color: #92400E; margin-bottom: 3px;">READY DATE</label>',
  '              <input type="date" id="vnd-pre-date-${order.id}" value="${this._esc(order.preorderReadyDate || "")}" style="width: 100%; height: 36px; padding: 0 8px; border: 1.5px solid #CBD5E1; border-radius: 8px; font-size: 0.85rem; box-sizing: border-box;" />',
  '            </div>',
  '            <div>',
  '              <label for="vnd-pre-time-${order.id}" style="display: block; font-size: 0.72rem; font-weight: 700; color: #92400E; margin-bottom: 3px;">READY TIME</label>',
  '              <input type="time" id="vnd-pre-time-${order.id}" value="${this._esc(order.preorderReadyTime || "12:00")}" style="width: 100%; height: 36px; padding: 0 8px; border: 1.5px solid #CBD5E1; border-radius: 8px; font-size: 0.85rem; box-sizing: border-box;" />',
  '            </div>',
  '          </div>',
  '          <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">',
  '            <button type="button" class="vnd-btn" onclick="VendorController.savePreorderSchedule(\'${order.id}\')" style="background: #D97706; color: #FFF; font-weight: 700; font-size: 0.8rem; padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer;">',
  '              💾 Save Ready Schedule',
  '            </button>',
  '            <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem; font-weight: 800; cursor: pointer; color: ${order.isFoodReady ? "#15803D" : "#1E293B"}; background: ${order.isFoodReady ? "#DCFCE7" : "#FFFFFF"}; padding: 7px 12px; border-radius: 8px; border: 1.5px solid ${order.isFoodReady ? "#22C55E" : "#CBD5E1"};">',
  '              <input type="checkbox" ${order.isFoodReady ? "checked" : ""} onchange="VendorController.toggleFoodReady(\'${order.id}\', this.checked)" style="width: 18px; height: 18px; accent-color: #16A34A; cursor: pointer;" />',
  '              <span>${order.isFoodReady ? "✅ Food is Ready for Delivery!" : "Tick when food is ready"}</span>',
  '            </label>',
  '          </div>',
  '        </div>',
  '        ` : ""}',
  '        <div class="vnd-order-items" style="margin-bottom: 12px;">${itemsHtml}</div>'
].join('\n');

// 4. Add methods to VendorController
const target6 = `  async rejectOrder(orderId) {`;

const repl6 = [
  '  async savePreorderSchedule(orderId) {',
  '    const dateInput = document.getElementById(`vnd-pre-date-${orderId}`);',
  '    const timeInput = document.getElementById(`vnd-pre-time-${orderId}`);',
  '    const preorderReadyDate = dateInput ? dateInput.value.trim() : "";',
  '    const preorderReadyTime = timeInput ? timeInput.value.trim() : "";',
  '',
  '    if (!preorderReadyDate || !preorderReadyTime) {',
  '      if (window.chowApp && window.chowApp.toast) {',
  '        window.chowApp.toast("Please specify both a ready date and time for delivery", "warning");',
  '      }',
  '      return;',
  '    }',
  '',
  '    const order = (window.chowStore?.state?.orders || []).find(o => o.id === orderId);',
  '    if (order) {',
  '      order.isPreorder = true;',
  '      order.preorderReadyDate = preorderReadyDate;',
  '      order.preorderReadyTime = preorderReadyTime;',
  '      window.chowStore.save();',
  '    }',
  '    const store = this.getStore();',
  '    if (store) this.renderKitchenOrders(store);',
  '',
  '    if (window.chowApp && window.chowApp.toast) {',
  '      window.chowApp.toast(`Ready schedule saved: ${preorderReadyDate} at ${preorderReadyTime}`, "success");',
  '    }',
  '',
  '    try {',
  '      const store = this.getStore();',
  '      await fetch("/api/vendor/orders/schedule", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        credentials: "include",',
  '        body: JSON.stringify({',
  '          orderId,',
  '          preorderReadyDate,',
  '          preorderReadyTime,',
  '          storeId: store?.id,',
  '          vendorId: store?.numericId',
  '        })',
  '      });',
  '      this.syncOrdersFromServer();',
  '    } catch (e) {',
  '      console.warn("[vendor] Failed to save preorder schedule to server:", e);',
  '    }',
  '  },',
  '',
  '  async toggleFoodReady(orderId, isReady) {',
  '    const order = (window.chowStore?.state?.orders || []).find(o => o.id === orderId);',
  '    if (order) {',
  '      order.isFoodReady = Boolean(isReady);',
  '      if (isReady) {',
  '        order.foodReadyAt = new Date().toISOString();',
  '        order.status = "READY_FOR_PICKUP";',
  '      }',
  '      window.chowStore.save();',
  '    }',
  '    const store = this.getStore();',
  '    if (store) this.renderKitchenOrders(store);',
  '',
  '    const msg = isReady ? "✅ Food marked as READY for pickup & delivery!" : "Food marked as still preparing";',
  '    if (window.chowApp && window.chowApp.toast) {',
  '      window.chowApp.toast(msg, "success");',
  '    }',
  '',
  '    try {',
  '      const store = this.getStore();',
  '      await fetch("/api/vendor/orders/schedule", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        credentials: "include",',
  '        body: JSON.stringify({',
  '          orderId,',
  '          isFoodReady: Boolean(isReady),',
  '          storeId: store?.id,',
  '          vendorId: store?.numericId',
  '        })',
  '      });',
  '      this.syncOrdersFromServer();',
  '    } catch (e) {',
  '      console.warn("[vendor] Failed to save food ready state to server:", e);',
  '    }',
  '  },',
  '',
  '  async rejectOrder(orderId) {'
].join('\n');

if (!nS.includes(norm(target1)) || !nS.includes(norm(target2)) || !nS.includes(norm(target3)) || !nS.includes(norm(target4)) || !nS.includes(norm(target5)) || !nS.includes(norm(target6))) {
  console.error('Target not found in vendor.js');
  process.exit(1);
}

nS = nS
  .replace(norm(target1), norm(repl1))
  .replace(norm(target2), norm(repl2))
  .replace(norm(target3), norm(repl3))
  .replace(norm(target4), norm(repl4))
  .replace(norm(target5), norm(repl5))
  .replace(norm(target6), norm(repl6));

if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated vendor.js');
