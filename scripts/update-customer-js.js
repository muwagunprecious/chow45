const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/customer.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

// 1. In checkout verifyRes body, pass isPreorder and ready schedule
const target1 = `            routeDistanceMeters: newOrder.routeDistanceMeters || null,
            estimatedDurationSeconds: newOrder.estimatedDurationSeconds || null,
            items: newOrder.items || [],
            status: 'PENDING_PAYMENT'`;

const repl1 = `            routeDistanceMeters: newOrder.routeDistanceMeters || null,
            estimatedDurationSeconds: newOrder.estimatedDurationSeconds || null,
            isPreorder: Boolean(newOrder.isPreorder),
            preorderReadyDate: newOrder.preorderReadyDate || null,
            preorderReadyTime: newOrder.preorderReadyTime || null,
            isFoodReady: Boolean(newOrder.isFoodReady),
            items: newOrder.items || [],
            status: 'PENDING_PAYMENT'`;

// 2. In trackConfirmedOrder, render pre-order banner and strict no-demo rider text
const target2 = `    // Rider Dispatch Profile
    const rider = order.riderId ? (window.chowStore.state.riders || []).find(r => r.id === order.riderId) : null;
    const riderNameEl = document.getElementById('track-rider-name');
    const riderSubtextEl = document.getElementById('track-rider-subtext');
    const callBtn = document.getElementById('track-rider-call-btn');
    const waBtn = document.getElementById('track-rider-wa-btn');

    const realRiderName = (rider && rider.name) || order.riderName;
    const realRiderPhone = (rider && rider.phone) || order.riderPhone;
    const realRiderVehicle = (rider && rider.vehicle) || order.riderVehicle;

    if (realRiderName) {
      if (riderNameEl) riderNameEl.innerText = realRiderName;
      if (riderSubtextEl) riderSubtextEl.innerText = realRiderVehicle || 'Assigned Dispatch Rider';
      if (realRiderPhone) {
        if (callBtn) {
          callBtn.href = \`tel:\${realRiderPhone}\`;
          callBtn.style.display = 'inline-flex';
        }
        if (waBtn) {
          waBtn.href = \`https://wa.me/\${realRiderPhone.replace(/\\D/g, '')}\`;
          waBtn.style.display = 'inline-flex';
        }
      } else {
        if (callBtn) callBtn.style.display = 'none';
        if (waBtn) waBtn.style.display = 'none';
      }
    } else {
      if (riderNameEl) riderNameEl.innerText = 'Assigning rider...';
      if (riderSubtextEl) riderSubtextEl.innerText = 'Looking for nearby dispatch rider';
      if (callBtn) callBtn.style.display = 'none';
      if (waBtn) waBtn.style.display = 'none';
    }`;

const repl2 = [
  '    // Pre-order Live Banner',
  '    const preBanner = document.getElementById(\'track-preorder-banner\');',
  '    const preDateEl = document.getElementById(\'track-preorder-date\');',
  '    const preTimeEl = document.getElementById(\'track-preorder-time\');',
  '    const preReadyBadge = document.getElementById(\'track-preorder-readiness-badge\');',
  '    if (preBanner && preDateEl && preTimeEl && preReadyBadge) {',
  '      if (order.isPreorder) {',
  '        preBanner.style.display = \'block\';',
  '        preDateEl.innerText = order.preorderReadyDate || \'Scheduled date pending\';',
  '        preTimeEl.innerText = order.preorderReadyTime || \'Scheduled time pending\';',
  '        if (order.isFoodReady) {',
  '          preReadyBadge.innerText = \'✅ Food Ready for Delivery\';',
  '          preReadyBadge.style.background = \'#DCFCE7\';',
  '          preReadyBadge.style.color = \'#15803D\';',
  '          preReadyBadge.style.border = \'1px solid #86EFAC\';',
  '        } else {',
  '          preReadyBadge.innerText = \'⏳ Kitchen Preparing\';',
  '          preReadyBadge.style.background = \'#FEF3C7\';',
  '          preReadyBadge.style.color = \'#B45309\';',
  '          preReadyBadge.style.border = \'1px solid #FDE68A\';',
  '        }',
  '      } else {',
  '        preBanner.style.display = \'none\';',
  '      }',
  '    }',
  '',
  '    // Rider Dispatch Profile (STRICT: Never show demo/fake rider when order has no assigned rider)',
  '    const hasAssignedRider = Boolean(order.riderId);',
  '    const rider = hasAssignedRider ? (window.chowStore.state.riders || []).find(r => r.id === order.riderId) : null;',
  '    const riderNameEl = document.getElementById(\'track-rider-name\');',
  '    const riderSubtextEl = document.getElementById(\'track-rider-subtext\');',
  '    const callBtn = document.getElementById(\'track-rider-call-btn\');',
  '    const waBtn = document.getElementById(\'track-rider-wa-btn\');',
  '',
  '    const realRiderName = hasAssignedRider ? ((rider && rider.name) || order.riderName) : null;',
  '    const realRiderPhone = hasAssignedRider ? ((rider && rider.phone) || order.riderPhone) : null;',
  '    const realRiderVehicle = hasAssignedRider ? ((rider && rider.vehicle) || order.riderVehicle) : null;',
  '',
  '    if (realRiderName) {',
  '      if (riderNameEl) riderNameEl.innerText = realRiderName;',
  '      if (riderSubtextEl) riderSubtextEl.innerText = realRiderVehicle || \'Assigned Dispatch Rider\';',
  '      if (realRiderPhone) {',
  '        if (callBtn) {',
  '          callBtn.href = `tel:${realRiderPhone}`;',
  '          callBtn.style.display = \'inline-flex\';',
  '        }',
  '        if (waBtn) {',
  '          waBtn.href = `https://wa.me/${realRiderPhone.replace(/\\D/g, \'\')}`;',
  '          waBtn.style.display = \'inline-flex\';',
  '        }',
  '      } else {',
  '        if (callBtn) callBtn.style.display = \'none\';',
  '        if (waBtn) waBtn.style.display = \'none\';',
  '      }',
  '    } else {',
  '      if (riderNameEl) riderNameEl.innerText = \'Assigning dispatch rider...\';',
  '      if (riderSubtextEl) {',
  '        riderSubtextEl.innerText = order.isPreorder',
  '          ? \'Pre-order confirmed · Rider will be assigned closer to delivery time\'',
  '          : \'Kitchen is preparing your meal · Searching for nearby dispatch rider\';',
  '      }',
  '      if (callBtn) callBtn.style.display = \'none\';',
  '      if (waBtn) waBtn.style.display = \'none\';',
  '    }'
].join('\n');

// 3. In tracking poll, update preorder info live and keep strict rider check
const target3 = `            if (trackData && (trackData.riderName || trackData.riderId)) {
              const rNameEl = document.getElementById('track-rider-name');
              const rSubtextEl = document.getElementById('track-rider-subtext');
              const cBtn = document.getElementById('track-rider-call-btn');
              const wBtn = document.getElementById('track-rider-wa-btn');

              if (rNameEl && trackData.riderName) rNameEl.innerText = trackData.riderName;
              if (rSubtextEl) rSubtextEl.innerText = trackData.riderVehicle || 'Assigned Dispatch Rider';
              if (trackData.riderPhone) {
                if (cBtn) {
                  cBtn.href = \`tel:\${trackData.riderPhone}\`;
                  cBtn.style.display = 'inline-flex';
                }
                if (wBtn) {
                  wBtn.href = \`https://wa.me/\${trackData.riderPhone.replace(/\\D/g, '')}\`;
                  wBtn.style.display = 'inline-flex';
                }
              }
            }

            if (trackData && Number.isFinite(trackData.riderLat) && Number.isFinite(trackData.riderLng)) {
              if (window.chowMap && typeof window.chowMap.updateRiderPosition === 'function') {
                window.chowMap.updateRiderPosition(trackData.riderLng, trackData.riderLat, trackData.riderName);
              }
            }`;

const repl3 = [
  '            // Live Pre-Order schedule & food readiness update',
  '            if (trackData && trackData.isPreorder) {',
  '              const preBanner = document.getElementById(\'track-preorder-banner\');',
  '              const preDateEl = document.getElementById(\'track-preorder-date\');',
  '              const preTimeEl = document.getElementById(\'track-preorder-time\');',
  '              const preReadyBadge = document.getElementById(\'track-preorder-readiness-badge\');',
  '              if (preBanner && preDateEl && preTimeEl && preReadyBadge) {',
  '                preBanner.style.display = \'block\';',
  '                if (trackData.preorderReadyDate) preDateEl.innerText = trackData.preorderReadyDate;',
  '                if (trackData.preorderReadyTime) preTimeEl.innerText = trackData.preorderReadyTime;',
  '                if (trackData.isFoodReady) {',
  '                  preReadyBadge.innerText = \'✅ Food Ready for Delivery\';',
  '                  preReadyBadge.style.background = \'#DCFCE7\';',
  '                  preReadyBadge.style.color = \'#15803D\';',
  '                  preReadyBadge.style.border = \'1px solid #86EFAC\';',
  '                } else {',
  '                  preReadyBadge.innerText = \'⏳ Kitchen Preparing\';',
  '                  preReadyBadge.style.background = \'#FEF3C7\';',
  '                  preReadyBadge.style.color = \'#B45309\';',
  '                  preReadyBadge.style.border = \'1px solid #FDE68A\';',
  '                }',
  '              }',
  '            }',
  '',
  '            // Live Rider Dispatch Profile: strictly real assigned rider ONLY',
  '            const rNameEl = document.getElementById(\'track-rider-name\');',
  '            const rSubtextEl = document.getElementById(\'track-rider-subtext\');',
  '            const cBtn = document.getElementById(\'track-rider-call-btn\');',
  '            const wBtn = document.getElementById(\'track-rider-wa-btn\');',
  '',
  '            if (trackData && trackData.riderId && trackData.riderName) {',
  '              if (rNameEl) rNameEl.innerText = trackData.riderName;',
  '              if (rSubtextEl) rSubtextEl.innerText = trackData.riderVehicle || \'Assigned Dispatch Rider\';',
  '              if (trackData.riderPhone) {',
  '                if (cBtn) {',
  '                  cBtn.href = `tel:${trackData.riderPhone}`;',
  '                  cBtn.style.display = \'inline-flex\';',
  '                }',
  '                if (wBtn) {',
  '                  wBtn.href = `https://wa.me/${trackData.riderPhone.replace(/\\D/g, \'\')}`;',
  '                  wBtn.style.display = \'inline-flex\';',
  '                }',
  '              }',
  '              if (Number.isFinite(trackData.riderLat) && Number.isFinite(trackData.riderLng)) {',
  '                if (window.chowMap && typeof window.chowMap.updateRiderPosition === \'function\') {',
  '                  window.chowMap.updateRiderPosition(trackData.riderLng, trackData.riderLat, trackData.riderName);',
  '                }',
  '              }',
  '            } else {',
  '              if (rNameEl) rNameEl.innerText = \'Assigning dispatch rider...\';',
  '              if (rSubtextEl) {',
  '                rSubtextEl.innerText = (trackData && trackData.isPreorder)',
  '                  ? \'Pre-order confirmed · Rider will be assigned closer to delivery time\'',
  '                  : \'Kitchen is preparing your meal · Searching for nearby dispatch rider\';',
  '              }',
  '              if (cBtn) cBtn.style.display = \'none\';',
  '              if (wBtn) wBtn.style.display = \'none\';',
  '            }'
].join('\n');

if (!nS.includes(norm(target1)) || !nS.includes(norm(target2)) || !nS.includes(norm(target3))) {
  console.error('Target not found in customer.js');
  process.exit(1);
}

nS = nS
  .replace(norm(target1), norm(repl1))
  .replace(norm(target2), norm(repl2))
  .replace(norm(target3), norm(repl3));

if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated customer.js');
