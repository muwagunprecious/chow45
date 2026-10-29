/**
 * CHOW45 SEED DATA
 * Production Nigerian food marketplace dataset.
 * Locations: Idimu, Egbeda, Ikeja, Yaba, Surulere, Lekki, Sagamu / OOU Campus.
 * Featuring Mama T's Kitchen, authentic Nigerian dishes, add-ons, and categories.
 */

const CHOW45_LOCATIONS = [
  { id: 'lagos-idimu', name: '9 Goshen Ave, Idimu, Lagos', lat: 6.5742, lng: 3.2685, city: 'Lagos', type: 'Home' },
  { id: 'lagos-egbeda', name: 'Egbeda Bus Stop, Akowonjo Rd, Lagos', lat: 6.5910, lng: 3.2890, city: 'Lagos', type: 'Work' },
  { id: 'lagos-ikeja', name: 'Ikeja City Mall / Allen Ave, Lagos', lat: 6.6018, lng: 3.3515, city: 'Lagos', type: 'Work' },
  { id: 'lagos-yaba', name: 'Herbert Macaulay Way, Yaba, Lagos', lat: 6.5180, lng: 3.3760, city: 'Lagos', type: 'School' },
  { id: 'lagos-surulere', name: 'Adeniran Ogunsanya, Surulere, Lagos', lat: 6.4975, lng: 3.3582, city: 'Lagos', type: 'Other' },
  { id: 'lagos-lekki', name: 'Admiralty Way, Lekki Phase 1, Lagos', lat: 6.4474, lng: 3.4735, city: 'Lagos', type: 'Home' },
  { id: 'oou-main', name: 'OOU Main Campus Gate, Ago-Iwoye', lat: 6.8482, lng: 3.6545, city: 'Ogun', type: 'Campus' },
  { id: 'oou-med', name: 'OOU Teaching Hospital & Med Campus, Sagamu', lat: 6.8390, lng: 3.6480, city: 'Ogun', type: 'Campus' },
  { id: 'ogun-ibogun', name: 'OGITECH Ibogun Campus, Ifo', lat: 6.7200, lng: 3.3900, city: 'Ogun', type: 'Campus' }
];

const CHOW45_CATEGORIES = [
  { id: 'all', name: 'All Food', icon: '🍽️', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🍽️%3C/text%3E%3C/svg%3E" },
  { id: 'rice', name: 'Rice', icon: '🍚', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🍚%3C/text%3E%3C/svg%3E" },
  { id: 'chicken', name: 'Chicken', icon: '🍗', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🍗%3C/text%3E%3C/svg%3E" },
  { id: 'soups', name: 'Soups & Swallows', icon: '🍲', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🍲%3C/text%3E%3C/svg%3E" },
  { id: 'grills', name: 'Suya & Grills', icon: '🥩', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🥩%3C/text%3E%3C/svg%3E" },
  { id: 'shawarma', name: 'Shawarma & Burgers', icon: '🌯', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🌯%3C/text%3E%3C/svg%3E" },
  { id: 'pasta', name: 'Pasta & Noodles', icon: '🍝', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🍝%3C/text%3E%3C/svg%3E" },
  { id: 'african', name: 'African Classics', icon: '🥘', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🥘%3C/text%3E%3C/svg%3E" },
  { id: 'drinks', name: 'Drinks', icon: '🥤', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🥤%3C/text%3E%3C/svg%3E" },
  { id: 'snacks', name: 'Snacks & Desserts', icon: '🥧', img: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='100%25' height='100%25' fill='%23F1F5F9' rx='20'/%3E%3Ctext x='50%25' y='55%25' font-size='50' text-anchor='middle' dominant-baseline='middle'%3E🥧%3C/text%3E%3C/svg%3E" }
];

// Real restaurants and uploaded foods are loaded dynamically from real vendors.
const CHOW45_RESTAURANTS = [];

// Real dispatch riders are loaded dynamically from verified registered fleet accounts.
const CHOW45_RIDERS = [];

// Delivery fee calculation is defined in service-zones.js and applied
// config-driven (baseFee + ratePerMeter). Kept as a compat alias only.
const legacyCalculateDeliveryFee = (d) => Math.max(500, Math.round((400 + d * 150) / 50) * 50);

// Fixed platform service fee — reconciled against DEFAULT_DELIVERY_FEE_CONFIG (₦400).
const MANDATORY_SERVICE_FEE = (typeof DEFAULT_DELIVERY_FEE_CONFIG !== 'undefined' && DEFAULT_DELIVERY_FEE_CONFIG.serviceFee) || 500;
