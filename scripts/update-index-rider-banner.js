const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/index.html';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

const target = `                <span id="mission-order-id" class="mission-order-badge"></span>
              </div>

              <!-- Pickup & Delivery Addresses -->`;

const repl = `                <span id="mission-order-id" class="mission-order-badge"></span>
              </div>

              <!-- Pre-Order Mission Schedule Card (Shown when order is preorder) -->
              <div id="mission-preorder-banner" style="display: none; background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 14px; padding: 12px 16px; margin-bottom: 14px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-weight: 800; font-size: 0.8rem; color: #92400E; text-transform: uppercase;">🗓️ PRE-ORDER DELIVERY</span>
                  <span id="mission-preorder-ready-tag" style="font-size: 0.76rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; background: #FEF3C7; color: #B45309;">⏳ Kitchen Preparing</span>
                </div>
                <div style="font-size: 0.85rem; color: #78350F; font-weight: 600;">
                  Ready for Delivery: <strong id="mission-preorder-datetime" style="color: #92400E;"></strong>
                </div>
              </div>

              <!-- Pickup & Delivery Addresses -->`;

if (!nS.includes(norm(target))) {
  console.error('Target not found in public/app/index.html');
  process.exit(1);
}

nS = nS.replace(norm(target), norm(repl));
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated rider active mission in public/app/index.html');
