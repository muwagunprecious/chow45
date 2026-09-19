/**
 * CHOW45 SEED DATA
 * Authentic Nigerian restaurants, campus favorites (OOU Sagamu & Lagos),
 * rich food menus, add-on customization groups, and presets.
 */

const CHOW45_LOCATIONS = [
  { id: 'oou-main', name: 'OOU Main Campus Gate (Ago Iwoye / Sagamu)', lat: 6.8482, lng: 3.6545, city: 'Sagamu' },
  { id: 'oou-law', name: 'Faculty of Law & Admin Complex, OOU', lat: 6.8450, lng: 3.6520, city: 'Sagamu' },
  { id: 'oou-med', name: 'OOU Teaching Hospital & Med Campus', lat: 6.8390, lng: 3.6480, city: 'Sagamu' },
  { id: 'oou-ps', name: 'Permanent Site (PS Gate) Student Hostels', lat: 6.8520, lng: 3.6580, city: 'Sagamu' },
  { id: 'sagamu-high', name: 'Sagamu High Street / GRA', lat: 6.8320, lng: 3.6420, city: 'Sagamu' },
  { id: 'lagos-yaba', name: 'Yaba Tech / Unilag Axis, Lagos', lat: 6.5180, lng: 3.3760, city: 'Lagos' },
  { id: 'lagos-ikeja', name: 'Ikeja City Mall / Allen, Lagos', lat: 6.6018, lng: 3.3515, city: 'Lagos' },
  { id: 'lagos-lekki', name: 'Lekki Phase 1 / Admiralty, Lagos', lat: 6.4474, lng: 3.4735, city: 'Lagos' },
  { id: 'lagos-surulere', name: 'Surulere (Adeniran Ogunsanya), Lagos', lat: 6.4975, lng: 3.3582, city: 'Lagos' }
];

const CHOW45_CATEGORIES = [
  { id: 'all', name: 'All Cravings', icon: '🍽️', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=150&auto=format&fit=crop&q=80' },
  { id: 'jollof', name: 'Jollof & Rice', icon: '🍚', img: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=150&auto=format&fit=crop&q=80' },
  { id: 'swallow', name: 'Swallows & Soups', icon: '🍲', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&auto=format&fit=crop&q=80' },
  { id: 'grills', name: 'Suya & Grills', icon: '🥩', img: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=150&auto=format&fit=crop&q=80' },
  { id: 'shawarma', name: 'Shawarma & Fast Food', icon: '🌯', img: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=150&auto=format&fit=crop&q=80' },
  { id: 'campus', name: 'Campus Budget (≤₦1.5k)', icon: '🎓', img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=150&auto=format&fit=crop&q=80' },
  { id: 'drinks', name: 'Drinks & Chill', icon: '🥤', img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=150&auto=format&fit=crop&q=80' },
  { id: 'market', name: 'Local Market Groceries', icon: '🥦', img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=150&auto=format&fit=crop&q=80' }
];

const CHOW45_RESTAURANTS = [
  {
    id: 'rest-1',
    name: 'Mama Put OOU Special',
    slug: 'mama-put-oou',
    rating: 4.8,
    reviewsCount: 342,
    prepTime: '20 - 30 min',
    distanceKm: 1.2,
    deliveryFee: 400,
    tags: ['Authentic Naija', 'Campus Favorite', 'Jollof & Swallow'],
    category: 'jollof',
    isBudget: true,
    bannerImg: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&auto=format&fit=crop&q=80',
    address: 'Near OOU Main Gate, Ago-Iwoye Rd, Sagamu axis',
    lat: 6.8475,
    lng: 3.6530,
    open: true,
    menu: [
      {
        id: 'dish-101',
        name: 'Smokey Party Jollof & Peppered Chicken',
        desc: 'Signature Nigerian firewood party jollof served with crispy fried plantain (dodo) and succulent peppered chicken.',
        price: 2600,
        img: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Choose Your Protein Portion',
            required: true,
            options: [
              { name: 'Peppered Fried Chicken (Quarter)', price: 0 },
              { name: 'Spicy Turkey Wing', price: 900 },
              { name: 'Peppered Goat Meat (Asun Cut)', price: 1100 },
              { name: 'Fresh Fried Fish (Titus)', price: 700 }
            ]
          },
          {
            title: 'Extra Delicious Add-ons',
            required: false,
            options: [
              { name: 'Extra Golden Fried Plantain (Dodo)', price: 500 },
              { name: 'Hard Boiled Egg', price: 300 },
              { name: 'Creamy Naija Coleslaw', price: 450 },
              { name: 'Extra Fiery Pepper Sauce', price: 200 }
            ]
          }
        ]
      },
      {
        id: 'dish-102',
        name: 'Pounded Yam with Rich Egusi & Assorted Meat',
        desc: 'Smooth hot pounded yam accompanied by authentic melon seed Egusi soup with shredded stockfish and tender beef cuts.',
        price: 2900,
        img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Select Swallow Type',
            required: true,
            options: [
              { name: 'Fresh Pounded Yam (Standard)', price: 0 },
              { name: 'Hot Soft Amala (Dudu)', price: 0 },
              { name: 'Yellow Garri Eba', price: -200 }
            ]
          },
          {
            title: 'Add Extra Meat / Fish',
            required: false,
            options: [
              { name: 'Soft Beef Cow Leg (Bokoto)', price: 800 },
              { name: 'Smoked Catfish Piece', price: 1200 },
              { name: 'Tender Shaki (Tripe)', price: 600 }
            ]
          }
        ]
      },
      {
        id: 'dish-103',
        name: 'Student Pocket Jollof + Fried Egg',
        desc: 'Filling portion of smokey jollof rice topped with a seasoned sunny-side fried egg. Fast and budget-friendly.',
        price: 1350,
        img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Extras for Student Combo',
            required: false,
            options: [
              { name: 'Fried Dodo Side', price: 400 },
              { name: 'Chilled Bottle Water (75cl)', price: 200 },
              { name: 'Chilled Malta Guinness', price: 500 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'rest-2',
    name: 'The Suya Sanctuary',
    slug: 'suya-sanctuary',
    rating: 4.9,
    reviewsCount: 512,
    prepTime: '15 - 25 min',
    distanceKm: 2.1,
    deliveryFee: 500,
    tags: ['Night Grills', 'Authentic Yaji', 'Late Night'],
    category: 'grills',
    isBudget: false,
    bannerImg: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&auto=format&fit=crop&q=80',
    address: 'Sabo Market Junction, Sagamu High St',
    lat: 6.8335,
    lng: 3.6440,
    open: true,
    menu: [
      {
        id: 'dish-201',
        name: 'Prime Beef Suya Platter (Generous Pack)',
        desc: 'Charcoal-grilled thin beef skewers dusted in authentic Northern Yaji spice blend, served with fresh onions and cabbage.',
        price: 3500,
        img: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Heat Level',
            required: true,
            options: [
              { name: 'Medium Yaji Pepper', price: 0 },
              { name: 'Extra Fiery Yaji Powder', price: 0 },
              { name: 'Mild / Gentle Pepper', price: 0 }
            ]
          },
          {
            title: 'Suya Extras',
            required: false,
            options: [
              { name: 'Grilled Masa Cakes (2 pcs)', price: 600 },
              { name: 'Extra Sliced Red Onions & Tomatoes', price: 200 },
              { name: 'Chilled Can Coke (33cl)', price: 400 }
            ]
          }
        ]
      },
      {
        id: 'dish-202',
        name: 'Spicy Ram Suya & Masa Special',
        desc: 'Tender ram meat slow-roasted over aromatic wood embers with Hausa spices and fresh raw pepper garnishing.',
        price: 4200,
        img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Extras',
            required: false,
            options: [
              { name: 'Double Masa Cakes', price: 800 },
              { name: 'Extra Yaji Wrap', price: 150 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'rest-3',
    name: 'Tastee Campus Shawarma & Grills',
    slug: 'tastee-shawarma',
    rating: 4.7,
    reviewsCount: 289,
    prepTime: '15 - 20 min',
    distanceKm: 0.8,
    deliveryFee: 350,
    tags: ['Fast Food', 'Campus Hotspot', 'Loaded Shawarma'],
    category: 'shawarma',
    isBudget: true,
    bannerImg: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=800&auto=format&fit=crop&q=80',
    address: 'Campus Commercial Hub, Opposite PS Gate',
    lat: 6.8510,
    lng: 3.6570,
    open: true,
    menu: [
      {
        id: 'dish-301',
        name: 'Double Sausage Jumbo Chicken Shawarma',
        desc: 'Loaded flatbread wrap packed with shredded grilled chicken, 2 gala sausages, sweet cream mayo sauce and crisp vegetables.',
        price: 2400,
        img: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Shawarma Customization',
            required: true,
            options: [
              { name: 'Standard Creamy Sweet Sauce', price: 0 },
              { name: 'Extra Hot Chili Spice Sauce', price: 0 }
            ]
          },
          {
            title: 'Extra Fillings',
            required: false,
            options: [
              { name: 'Extra Melted Cheddar Cheese', price: 600 },
              { name: 'Additional Grilled Sausage', price: 400 },
              { name: 'Extra Shredded Chicken', price: 800 }
            ]
          }
        ]
      },
      {
        id: 'dish-302',
        name: 'Crispy Peppered Chicken & French Fries',
        desc: 'Golden seasoned potato fries accompanied by spicy tender peppered drumstick chicken and ketchup dip.',
        price: 2800,
        img: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Drink Pair',
            required: false,
            options: [
              { name: 'Chilled Hollandia Yoghurt (315ml)', price: 700 },
              { name: 'Ice Cold Pepsi', price: 400 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'rest-4',
    name: 'Amala Shitta & Buka Express',
    slug: 'amala-shitta-express',
    rating: 4.8,
    reviewsCount: 620,
    prepTime: '20 - 35 min',
    distanceKm: 2.8,
    deliveryFee: 600,
    tags: ['Amala Spot', 'Gbegiri & Ewedu', 'Abula'],
    category: 'swallow',
    isBudget: false,
    bannerImg: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    address: 'GRA Extension, Sagamu expressway link',
    lat: 6.8380,
    lng: 3.6390,
    open: true,
    menu: [
      {
        id: 'dish-401',
        name: 'Fluffy Hot Amala Abula Combo (Gbegiri + Ewedu + Obe Ata)',
        desc: 'Silky smooth Oyo black yam flour swallow bathed in hot gbegiri (bean soup), fresh ewedu, and rich fiery pepper stew with assorted meats.',
        price: 3200,
        img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: [
          {
            title: 'Choose 2 Pieces of Meat',
            required: true,
            options: [
              { name: 'Tender Beef & Soft Ponmo', price: 0 },
              { name: 'Goat Meat (Ogufe) & Shaki', price: 900 },
              { name: 'Fried Panla Fish & Beef', price: 600 }
            ]
          },
          {
            title: 'Add Extra Swallow',
            required: false,
            options: [
              { name: 'Extra Wrap of Hot Amala', price: 400 },
              { name: 'Extra Round of Cow Skin (Ponmo Alata)', price: 350 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'rest-5',
    name: 'Sagamu Fresh Market & Provisions',
    slug: 'fresh-market-sagamu',
    rating: 4.6,
    reviewsCount: 140,
    prepTime: '30 - 45 min',
    distanceKm: 3.0,
    deliveryFee: 700,
    tags: ['Groceries', 'Fruits', 'Fresh Produce'],
    category: 'market',
    isBudget: true,
    bannerImg: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&auto=format&fit=crop&q=80',
    address: 'Main Market Terminal, Sagamu',
    lat: 6.8310,
    lng: 3.6490,
    open: true,
    menu: [
      {
        id: 'dish-501',
        name: 'Fresh Tropical Fruit Basket (Watermelon, Pineapple, Banana)',
        desc: 'Hand-picked ripe fruits cleanly washed, sliced and hygienically packed for student wellness and vitamins.',
        price: 2200,
        img: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: []
      },
      {
        id: 'dish-502',
        name: 'Student Grocery Basket (Indomie Super Pack x5 + Eggs + Oil)',
        desc: 'Fast hostel survival kit with 5 Indomie Onion Chicken packs, 5 fresh eggs, and pepper seasoning sachets.',
        price: 3400,
        img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        addonGroups: []
      }
    ]
  }
];

const CHOW45_RIDERS = [
  {
    id: 'rider-1',
    name: 'Tunde Adeleke',
    phone: '+234 812 490 2819',
    vehicle: 'Bajaj Boxer 150 (Plate: SGM-452-OG)',
    rating: 4.9,
    tripsCount: 840,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    online: true,
    currentLat: 6.8490,
    currentLng: 3.6535
  },
  {
    id: 'rider-2',
    name: 'Chinedu Okafor',
    phone: '+234 803 891 4410',
    vehicle: 'TVS Neo Scooter (Plate: LAG-881-IKJ)',
    rating: 4.8,
    tripsCount: 620,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    online: true,
    currentLat: 6.8440,
    currentLng: 3.6510
  }
];

// Delivery fee calculation based on distance
function calculateDeliveryFee(distanceKm) {
  // Base ₦300 + ₦100 per km rounded to nearest ₦50
  const fee = Math.max(350, Math.round((300 + distanceKm * 100) / 50) * 50);
  return fee;
}

const MANDATORY_SERVICE_FEE = 500; // Fixed ₦500 Platform Service Fee
