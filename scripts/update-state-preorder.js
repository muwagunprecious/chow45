const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/state.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

const target1 = `    const total = subtotal + serviceFee + deliveryFee;

    const newOrder = {`;

const repl1 = `    const total = subtotal + serviceFee + deliveryFee;

    const hasPreorderItems = (this.state.cart.items || []).some(i => Boolean(i.preorderEnabled));
    const isPreorder = Boolean(orderDetails.isPreorder ?? hasPreorderItems);
    const preorderItem = (this.state.cart.items || []).find(i => Boolean(i.preorderEnabled) && (i.preorderDate || i.preorderTime));
    const preorderReadyDate = orderDetails.preorderReadyDate || (preorderItem ? preorderItem.preorderDate : '') || '';
    const preorderReadyTime = orderDetails.preorderReadyTime || (preorderItem ? preorderItem.preorderTime : '') || '';

    const newOrder = {
      isPreorder,
      preorderReadyDate,
      preorderReadyTime,
      isFoodReady: false,
      foodReadyAt: null,`;

const target2 = `    if (extra.riderId) {
      order.riderId = extra.riderId;
      order.riderName = extra.riderName;
    }`;

const repl2 = `    if (extra.riderId) {
      order.riderId = extra.riderId;
      order.riderName = extra.riderName;
    }
    if (extra.isPreorder !== undefined) order.isPreorder = Boolean(extra.isPreorder);
    if (extra.preorderReadyDate !== undefined) order.preorderReadyDate = extra.preorderReadyDate;
    if (extra.preorderReadyTime !== undefined) order.preorderReadyTime = extra.preorderReadyTime;
    if (extra.isFoodReady !== undefined) {
      order.isFoodReady = Boolean(extra.isFoodReady);
      if (order.isFoodReady) order.foodReadyAt = new Date().toISOString();
    }`;

if (!nS.includes(norm(target1)) || !nS.includes(norm(target2))) {
  console.error('Target not found in state.js');
  process.exit(1);
}

nS = nS.replace(norm(target1), norm(repl1)).replace(norm(target2), norm(repl2));
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated state.js');
