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
  { id: 'all', name: 'All Food', icon: '🍽️', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=150&auto=format&fit=crop&q=80' },
  { id: 'rice', name: 'Rice', icon: '🍚', img: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=150&auto=format&fit=crop&q=80' },
  { id: 'chicken', name: 'Chicken', icon: '🍗', img: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=150&auto=format&fit=crop&q=80' },
  { id: 'soups', name: 'Soups & Swallows', icon: '🍲', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&auto=format&fit=crop&q=80' },
  { id: 'grills', name: 'Suya & Grills', icon: '🥩', img: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=150&auto=format&fit=crop&q=80' },
  { id: 'shawarma', name: 'Shawarma & Burgers', icon: '🌯', img: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=150&auto=format&fit=crop&q=80' },
  { id: 'pasta', name: 'Pasta & Noodles', icon: '🍝', img: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=150&auto=format&fit=crop&q=80' },
  { id: 'african', name: 'African Classics', icon: '🥘', img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=150&auto=format&fit=crop&q=80' },
  { id: 'drinks', name: 'Drinks', icon: '🥤', img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=150&auto=format&fit=crop&q=80' },
  { id: 'snacks', name: 'Snacks & Desserts', icon: '🥧', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150&auto=format&fit=crop&q=80' }
];

// Real restaurants and uploaded foods are loaded dynamically from real vendors.
const CHOW45_RESTAURANTS = [];

const CHOW45_RIDERS = [
  {
    id: 'rider-david',
    name: 'David Adeleke',
    phone: '+234 812 490 2819',
    vehicle: 'Bajaj Boxer 150 (Plate: LAG-452-IKJ)',
    rating: 4.9,
    tripsCount: 840,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    online: true,
    currentLat: 6.5760,
    currentLng: 3.2700
  },
  {
    id: 'rider-chinedu',
    name: 'Chinedu Okafor',
    phone: '+234 803 891 4410',
    vehicle: 'TVS Neo Scooter (Plate: SGM-881-OG)',
    rating: 4.8,
    tripsCount: 620,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    online: true,
    currentLat: 6.8450,
    currentLng: 3.6520
  }
];

// Delivery fee calculation is defined in service-zones.js and applied
// config-driven (baseFee + ratePerMeter). Kept as a compat alias only.
const legacyCalculateDeliveryFee = (d) => Math.max(500, Math.round((400 + d * 150) / 50) * 50);

// Fixed platform service fee — reconciled against DEFAULT_DELIVERY_FEE_CONFIG (₦400).
const MANDATORY_SERVICE_FEE = (typeof DEFAULT_DELIVERY_FEE_CONFIG !== 'undefined' && DEFAULT_DELIVERY_FEE_CONFIG.serviceFee) || 500;
