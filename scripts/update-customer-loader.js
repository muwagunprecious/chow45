const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/customer.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

// 1. Add isLoading, isInitialLoaded to CustomerController
const target1 = `const CustomerController = {
  activeRestaurant: null,
  activeCustomizingDish: null,
  selectedAddons: [],
  customizingQty: 1,`;

const repl1 = `const CustomerController = {
  activeRestaurant: null,
  activeCustomizingDish: null,
  selectedAddons: [],
  customizingQty: 1,
  isLoading: true,
  isInitialLoaded: false,`;

// 2. Update init() and add fetchStoresBootstrap()
const target2 = `  init() {
    this.bindEvents();
    this.render();
  },`;

const repl2 = `  init() {
    const hasStores = Array.isArray(window.chowStore?.state?.restaurants) && window.chowStore.state.restaurants.length > 0;
    this.isInitialLoaded = hasStores;
    this.isLoading = !hasStores;

    this.bindEvents();
    this.render();

    if (!hasStores) {
      this.fetchStoresBootstrap();
    }
  },

  async fetchStoresBootstrap() {
    try {
      const res = await fetch('/api/bootstrap');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stores) && data.stores.length > 0) {
          window.chowStore.state.restaurants = data.stores;
          window.chowStore.save();
        }
      }
    } catch (e) {
      console.warn('[customer] bootstrap fetch error:', e);
    } finally {
      this.isLoading = false;
      this.isInitialLoaded = true;
      this.render();
    }
  },

  renderLoadingState() {
    return \`
      <div class="discovery-loading-container" style="padding: 24px 0 40px;">
        <div style="text-align: center; padding: 24px 16px 32px;">
          <div class="chow-loader-spinner" style="width: 44px; height: 44px; border: 3.5px solid #E2E8F0; border-top-color: #00a205; border-radius: 50%; margin: 0 auto 14px; animation: chowRotate 0.8s linear infinite;"></div>
          <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: #0F172A; margin: 0 0 6px;">
            Loading campus food spots...
          </h3>
          <p style="color: #64748B; font-size: 0.86rem; margin: 0;">
            Fetching menus from kitchens around Sagamu &amp; Ibogun
          </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          \${[1, 2, 3, 4, 5, 6].map(() => \`
            <div style="background: #FFFFFF; border-radius: 18px; border: 1.5px solid #F1F5F9; overflow: hidden; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
              <div style="height: 160px; background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%); background-size: 200% 100%; animation: chowShimmer 1.5s infinite; border-radius: 14px; margin-bottom: 12px;"></div>
              <div style="height: 18px; width: 65%; background: #F1F5F9; border-radius: 6px; margin-bottom: 8px;"></div>
              <div style="height: 14px; width: 40%; background: #F8FAFC; border-radius: 6px; margin-bottom: 12px;"></div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #F1F5F9; padding-top: 10px;">
                <div style="height: 18px; width: 30%; background: #F1F5F9; border-radius: 6px;"></div>
                <div style="height: 32px; width: 80px; background: #E2E8F0; border-radius: 10px;"></div>
              </div>
            </div>
          \`).join('')}
        </div>
      </div>
      <style>
        @keyframes chowRotate {
          to { transform: rotate(360deg); }
        }
        @keyframes chowShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      </style>
    \`;
  },`;

// 3. In renderDiscoverySections, check if loading before rendering
const target3 = `  renderDiscoverySections() {
    const container = document.getElementById('discovery-sections-container');
    if (!container) return;

    const { restaurants, activeCategory, activeFilter, searchQuery, userProfile } = window.chowStore.state;

    // Filter restaurants`;

const repl3 = `  renderDiscoverySections() {
    const container = document.getElementById('discovery-sections-container');
    if (!container) return;

    const { restaurants, activeCategory, activeFilter, searchQuery, userProfile } = window.chowStore.state;

    // Show loader if still loading or restaurants not arrived yet
    const hasStores = Array.isArray(restaurants) && restaurants.length > 0;
    if (this.isLoading || (!this.isInitialLoaded && !hasStores)) {
      container.innerHTML = this.renderLoadingState();
      return;
    }

    // Filter restaurants`;

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
console.log('Successfully updated customer.js with loader functionality');
