const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/google-maps-service.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

const target = `    // Check if real rider coordinates exist on order or assigned rider
    const numRiderLng = Number(order.riderLng);
    const numRiderLat = Number(order.riderLat);
    if (Number.isFinite(numRiderLng) && Number.isFinite(numRiderLat)) {`;

const repl = `    // Check if real rider coordinates exist on order or assigned rider
    // STRICT: Only instantiate rider pin if an actual rider is assigned to the order
    const numRiderLng = Number(order.riderLng);
    const numRiderLat = Number(order.riderLat);
    if (order.riderId && Number.isFinite(numRiderLng) && Number.isFinite(numRiderLat)) {`;

if (!nS.includes(norm(target))) {
  console.error('Target not found in google-maps-service.js');
  process.exit(1);
}

nS = nS.replace(norm(target), norm(repl));
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated google-maps-service.js');
