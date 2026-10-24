const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/rider.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

// 1. Radar feed pre-order banner
const target1 = `            <div class="route-stop-line">
              <span class="stop-icon stop-pickup">P</span>`;

const repl1 = [
  '            ${order.isPreorder ? `',
  '            <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 10px; padding: 8px 12px; margin: 4px 0 8px; font-size: 0.8rem;">',
  '              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">',
  '                <span style="font-weight: 800; color: #92400E; font-size: 0.76rem;">🗓️ PRE-ORDER DELIVERY</span>',
  '                <span style="font-weight: 800; font-size: 0.74rem; color: ${order.isFoodReady ? "#15803D" : "#B45309"}; background: ${order.isFoodReady ? "#DCFCE7" : "#FEF3C7"}; padding: 2px 8px; border-radius: 999px; border: 1px solid ${order.isFoodReady ? "#86EFAC" : "#FDE68A"};">',
  '                  ${order.isFoodReady ? "✅ Food Ready for Pickup" : "⏳ Kitchen Preparing"}',
  '                </span>',
  '              </div>',
  '              <div style="color: #78350F; font-weight: 700;">',
  '                Scheduled Ready: ${order.preorderReadyDate || "Scheduled date"} ${order.preorderReadyTime ? "at " + order.preorderReadyTime : ""}',
  '              </div>',
  '            </div>',
  '            ` : ""}',
  '            <div class="route-stop-line">',
  '              <span class="stop-icon stop-pickup">P</span>'
].join('\n');

// 2. Active mission pre-order details
const target2 = `    const orderIdEl = document.getElementById('mission-order-id');
    if (orderIdEl) orderIdEl.innerText = \`#\${order.id}\`;`;

const repl2 = [
  '    const orderIdEl = document.getElementById(\'mission-order-id\');',
  '    if (orderIdEl) orderIdEl.innerText = `#${order.id}`;',
  '',
  '    // Pre-Order Mission Schedule',
  '    const preBanner = document.getElementById(\'mission-preorder-banner\');',
  '    const preReadyTag = document.getElementById(\'mission-preorder-ready-tag\');',
  '    const preDateTime = document.getElementById(\'mission-preorder-datetime\');',
  '    if (preBanner && preReadyTag && preDateTime) {',
  '      if (order.isPreorder) {',
  '        preBanner.style.display = \'block\';',
  '        preReadyTag.innerText = order.isFoodReady ? \'✅ Food Ready for Pickup\' : \'⏳ Kitchen Preparing\';',
  '        preReadyTag.style.background = order.isFoodReady ? \'#DCFCE7\' : \'#FEF3C7\';',
  '        preReadyTag.style.color = order.isFoodReady ? \'#15803D\' : \'#B45309\';',
  '        preReadyTag.style.border = order.isFoodReady ? \'1px solid #86EFAC\' : \'1px solid #FDE68A\';',
  '        preDateTime.innerText = `${order.preorderReadyDate || \'Scheduled Date\'} at ${order.preorderReadyTime || \'Scheduled Time\'}`;',
  '      } else {',
  '        preBanner.style.display = \'none\';',
  '      }',
  '    }'
].join('\n');

if (!nS.includes(norm(target1)) || !nS.includes(norm(target2))) {
  console.error('Target not found in rider.js');
  process.exit(1);
}

nS = nS.replace(norm(target1), norm(repl1)).replace(norm(target2), norm(repl2));
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated rider.js');
