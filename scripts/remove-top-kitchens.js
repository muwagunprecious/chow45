const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/customer.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

const target = `      <!-- Section 2: Restaurants Near You -->
      <div style="margin-bottom: var(--space-32);">
        <div class="section-header">
          <div>
            <h2 class="section-title">Top Kitchens & Restaurants</h2>
            <p style="font-size: 0.8rem; color: var(--c-text-secondary);">Verified hygienic local food spots</p>
          </div>
        </div>
        <div class="stores-grid">
          \${filteredStores.map(store => this.renderStoreCard(store)).join('')}
        </div>
      </div>
`;

if (!nS.includes(norm(target))) {
  console.error('Target not found in customer.js');
  process.exit(1);
}

nS = nS.replace(norm(target), '');
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully removed Top Kitchens & Restaurants section from customer.js');
