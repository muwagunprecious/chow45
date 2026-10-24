const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/index.html';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

const target1 = `            <p id="track-status-subtext" style="color: #64748B; font-size: 0.88rem; margin: 4px 0 0 0;">
              Your Order Is On The Way
            </p>
          </div>`;

const repl1 = `            <p id="track-status-subtext" style="color: #64748B; font-size: 0.88rem; margin: 4px 0 0 0;">
              Your Order Is On The Way
            </p>

            <!-- Pre-order Live Scheduled Banner -->
            <div id="track-preorder-banner" style="display: none; background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 16px; padding: 14px 18px; margin: 12px 0 8px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.08);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 800; color: #92400E; text-transform: uppercase; letter-spacing: 0.04em;">
                  🗓️ Pre-Order Delivery
                </span>
                <span id="track-preorder-readiness-badge" style="font-size: 0.76rem; font-weight: 800; padding: 4px 10px; border-radius: 999px; background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;">
                  ⏳ Kitchen Preparing
                </span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; color: #78350F; background: #FEF3C7; padding: 10px 12px; border-radius: 10px;">
                <div>
                  <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #92400E;">Delivery Date</div>
                  <strong id="track-preorder-date" style="font-size: 0.92rem; color: #78350F;">Scheduled</strong>
                </div>
                <div>
                  <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #92400E;">Ready Time</div>
                  <strong id="track-preorder-time" style="font-size: 0.92rem; color: #78350F;">--:--</strong>
                </div>
              </div>
            </div>
          </div>`;

const target2 = `                  <button class="vendor-tab-btn vnd-tab" data-tab="preparing" onclick="VendorController.setTab('preparing')">
                    🟡 Preparing <span id="vendor-count-preparing" class="tab-count">0</span>
                  </button>
                  <button class="vendor-tab-btn vnd-tab" data-tab="complete" onclick="VendorController.setTab('complete')">
                    🟢 Completed / In Transit
                  </button>`;

const repl2 = `                  <button class="vendor-tab-btn vnd-tab" data-tab="preparing" onclick="VendorController.setTab('preparing')">
                    🟡 Preparing <span id="vendor-count-preparing" class="tab-count">0</span>
                  </button>
                  <button class="vendor-tab-btn vnd-tab" data-tab="preorders" onclick="VendorController.setTab('preorders')">
                    🗓️ Pre-orders <span id="vendor-count-preorders" class="tab-count">0</span>
                  </button>
                  <button class="vendor-tab-btn vnd-tab" data-tab="complete" onclick="VendorController.setTab('complete')">
                    🟢 Completed / In Transit
                  </button>`;

if (!nS.includes(norm(target1)) || !nS.includes(norm(target2))) {
  console.error('Target not found in public/app/index.html');
  process.exit(1);
}

nS = nS.replace(norm(target1), norm(repl1)).replace(norm(target2), norm(repl2));
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated public/app/index.html');
