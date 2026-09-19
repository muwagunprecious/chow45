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
  { id: 'oou-main', name: 'OOU Main Campus Gate, Sagamu/Ago-Iwoye', lat: 6.8482, lng: 3.6545, city: 'Sagamu', type: 'School' },
  { id: 'oou-med', name: 'OOU Teaching Hospital & Med Campus, Sagamu', lat: 6.8390, lng: 3.6480, city: 'Sagamu', type: 'School' }
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

const CHOW45_RESTAURANTS = [
  {
    id: 'rest-mama-t',
    name: "Mama T's Kitchen",
    slug: 'mama-ts-kitchen',
    rating: 4.8,
    reviewsCount: 428,
    prepTime: '25–35 min',
    distanceKm: 1.8,
    deliveryFee: 800,
    address: '9 Goshen Ave, Idimu, Lagos',
    lat: 6.5750,
    lng: 3.2690,
    open: true,
    isVerified: true,
    tags: ['Authentic Naija', 'Popular in Idimu', 'Smokey Jollof'],
    category: 'rice',
    isBudget: false,
    isRecommended: true,
    isPopular: true,
    isFast: true,
    bannerImg: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&auto=format&fit=crop&q=80',
    menu: [
      {
        id: 'dish-mt-1',
        name: 'Jollof Rice',
        desc: 'Fresh Nigerian firewood jollof rice prepared daily with natural herbs, red bell peppers, and spices.',
        price: 3500,
        img: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'rice',
        rating: 4.9,
        prepTime: '25–35 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Choose Your Protein',
            required: true,
            options: [
              { name: 'Peppered Chicken', price: 1500 },
              { name: 'Tender Beef Cut', price: 1000 },
              { name: 'Fried Titus Fish', price: 2000 },
              { name: 'No protein', price: 0 }
            ]
          },
          {
            title: 'Delicious Extras',
            required: false,
            options: [
              { name: 'Fried Plantain (Dodo)', price: 700 },
              { name: 'Boiled Egg', price: 500 },
              { name: 'Fresh Naija Coleslaw', price: 500 },
              { name: 'Extra Fiery Pepper Sauce', price: 300 }
            ]
          }
        ]
      },
      {
        id: 'dish-mt-2',
        name: 'Special Fried Rice & Peppered Chicken',
        desc: 'Stir-fried basmati seasoned with liver cuts, green peas, sweetcorn, carrots and served with crispy fried chicken.',
        price: 4200,
        img: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'rice',
        rating: 4.8,
        prepTime: '20–30 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Extras',
            required: false,
            options: [
              { name: 'Fried Plantain (Dodo)', price: 700 },
              { name: 'Extra Peppered Drumstick', price: 1500 },
              { name: 'Creamy Coleslaw', price: 500 }
            ]
          }
        ]
      },
      {
        id: 'dish-mt-3',
        name: 'Ofada Rice with Spicy Ayamase Sauce',
        desc: 'Traditional unpolished aromatic Ofada rice wrapped in sweet banana leaves with bleaching palm oil green pepper stew and boiled egg.',
        price: 4800,
        img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'rice',
        rating: 4.9,
        prepTime: '25–35 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Extra Protein for Ayamase',
            required: false,
            options: [
              { name: 'Extra Assorted Meat (Shaki/Beef)', price: 1200 },
              { name: 'Hard Boiled Egg', price: 500 },
              { name: 'Fried Plantain', price: 700 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'rest-suya-hub',
    name: 'The Suya Sanctuary Idimu',
    slug: 'suya-sanctuary-idimu',
    rating: 4.9,
    reviewsCount: 512,
    prepTime: '15–25 min',
    distanceKm: 2.1,
    deliveryFee: 600,
    address: 'Council Bus Stop, Idimu-Egbeda Link, Lagos',
    lat: 6.5790,
    lng: 3.2720,
    open: true,
    isVerified: true,
    tags: ['Night Grills', 'Authentic Yaji', 'Late Night'],
    category: 'grills',
    isBudget: false,
    isRecommended: true,
    isPopular: true,
    isFast: true,
    bannerImg: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&auto=format&fit=crop&q=80',
    menu: [
      {
        id: 'dish-suya-1',
        name: 'Prime Beef Suya Platter',
        desc: 'Charcoal-grilled thin prime beef skewers dusted in authentic Northern Yaji spice blend, served with fresh red onions and tomatoes.',
        price: 3500,
        img: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'grills',
        rating: 4.9,
        prepTime: '15–25 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Yaji Pepper Spice Level',
            required: true,
            options: [
              { name: 'Medium Yaji Pepper', price: 0 },
              { name: 'Extra Fiery Yaji Powder', price: 0 },
              { name: 'Mild Pepper', price: 0 }
            ]
          },
          {
            title: 'Suya Accompaniments',
            required: false,
            options: [
              { name: 'Masa Cakes (2 pcs)', price: 600 },
              { name: 'Extra Sliced Red Onions & Tomatoes', price: 200 },
              { name: 'Chilled Can Coke (33cl)', price: 500 }
            ]
          }
        ]
      },
      {
        id: 'dish-suya-2',
        name: 'Spicy Asun Goat Meat (Generous Foil Pack)',
        desc: 'Tender diced goat meat fire-roasted with fresh scotch bonnet peppers, sweet red onions and aromatic spices.',
        price: 4500,
        img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'grills',
        rating: 4.8,
        prepTime: '20–30 min',
        isPopular: true,
        addonGroups: []
      }
    ]
  },
  {
    id: 'rest-bukka-hut',
    name: 'Bukka Hut Lagos',
    slug: 'bukka-hut-lagos',
    rating: 4.8,
    reviewsCount: 680,
    prepTime: '20–35 min',
    distanceKm: 2.8,
    deliveryFee: 750,
    address: 'Akowonjo Roundabout, Egbeda axis, Lagos',
    lat: 6.5890,
    lng: 3.2910,
    open: true,
    isVerified: true,
    tags: ['Amala Spot', 'Abula Special', 'Pounded Yam'],
    category: 'soups',
    isBudget: false,
    isRecommended: true,
    isPopular: true,
    isFast: false,
    bannerImg: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    menu: [
      {
        id: 'dish-bh-1',
        name: 'Pounded Yam with Rich Egusi & Assorted Meat',
        desc: 'Silky hot pounded yam served with thick melon seed Egusi soup packed with shredded stockfish, crayfish, and tender beef cuts.',
        price: 4600,
        img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'soups',
        rating: 4.9,
        prepTime: '20–35 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Choose Swallow Alternative',
            required: true,
            options: [
              { name: 'Fresh Pounded Yam (Default)', price: 0 },
              { name: 'Hot Black Amala (Oyo style)', price: 0 },
              { name: 'Yellow Garri Eba', price: -200 }
            ]
          },
          {
            title: 'Extra Meat Cut',
            required: false,
            options: [
              { name: 'Tender Cow Foot (Bokoto)', price: 900 },
              { name: 'Soft Beef Tripe (Shaki)', price: 700 },
              { name: 'Fried Panla Fish', price: 800 }
            ]
          }
        ]
      },
      {
        id: 'dish-bh-2',
        name: 'Hot Amala Abula Combo (Ewedu + Gbegiri + Obe Ata)',
        desc: 'Velvety smooth black yam flour swallow served in hot bean gbegiri soup, fresh ewedu, and peppery assorted stew.',
        price: 3800,
        img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'soups',
        rating: 4.8,
        prepTime: '20–30 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Select Assorted Meat',
            required: true,
            options: [
              { name: 'Beef + Soft Cow Skin (Ponmo)', price: 0 },
              { name: 'Goat Meat (Ogufe) + Shaki', price: 1100 },
              { name: 'Tender Oxtail Cut', price: 1400 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'rest-tastee-shawarma',
    name: 'Tastee Shawarma & Grills',
    slug: 'tastee-shawarma-grills',
    rating: 4.7,
    reviewsCount: 310,
    prepTime: '15–20 min',
    distanceKm: 1.2,
    deliveryFee: 500,
    address: 'Opposite Diamond Estate Gate, Idimu, Lagos',
    lat: 6.5710,
    lng: 3.2660,
    open: true,
    isVerified: true,
    tags: ['Fast Food', 'Double Sausage', 'Quick Bites'],
    category: 'shawarma',
    isBudget: true,
    isRecommended: true,
    isPopular: true,
    isFast: true,
    bannerImg: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=800&auto=format&fit=crop&q=80',
    menu: [
      {
        id: 'dish-ts-1',
        name: 'Double Sausage Jumbo Chicken Shawarma',
        desc: 'Loaded flatbread wrap packed with shredded grilled chicken, 2 beef sausages, signature creamy sweet sauce, and cabbage.',
        price: 2600,
        img: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'shawarma',
        rating: 4.8,
        prepTime: '15–20 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Sauce Preference',
            required: true,
            options: [
              { name: 'Creamy Sweet Mayo Sauce', price: 0 },
              { name: 'Spicy Chili Pepper Sauce', price: 0 }
            ]
          },
          {
            title: 'Add Extra Fillings',
            required: false,
            options: [
              { name: 'Extra Cheddar Cheese Slice', price: 600 },
              { name: 'Extra Grilled Beef Sausage', price: 400 },
              { name: 'Extra Shredded Chicken', price: 800 }
            ]
          }
        ]
      },
      {
        id: 'dish-ts-2',
        name: 'Crispy Peppered Chicken & French Fries',
        desc: 'Golden seasoned potato fries accompanied by spicy crispy chicken drumstick and creamy dip.',
        price: 2900,
        img: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'chicken',
        rating: 4.7,
        prepTime: '15–25 min',
        isPopular: false,
        addonGroups: []
      }
    ]
  },
  {
    id: 'rest-campus-pocket',
    name: 'Campus Pocket Chow',
    slug: 'campus-pocket-chow',
    rating: 4.6,
    reviewsCount: 220,
    prepTime: '15–20 min',
    distanceKm: 0.9,
    deliveryFee: 400,
    address: 'Student Canteen Axis, OOU Sagamu / Idimu Hub',
    lat: 6.8475,
    lng: 3.6530,
    open: true,
    isVerified: true,
    tags: ['Student Deals', 'Budget-Friendly', 'Affordable Chow'],
    category: 'rice',
    isBudget: true,
    isRecommended: false,
    isPopular: true,
    isFast: true,
    bannerImg: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    menu: [
      {
        id: 'dish-cp-1',
        name: 'Student Pocket Jollof + Fried Egg',
        desc: 'Hearty plate of firewood jollof rice served with seasoned fried egg. Fast, tasty, and easy on the wallet.',
        price: 1500,
        img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'rice',
        rating: 4.7,
        prepTime: '15–20 min',
        isPopular: true,
        addonGroups: [
          {
            title: 'Extras',
            required: false,
            options: [
              { name: 'Fried Plantain (Dodo)', price: 400 },
              { name: 'Chilled Bottle Water', price: 200 }
            ]
          }
        ]
      },
      {
        id: 'dish-cp-2',
        name: 'Crispy Meatpie + Cold Chivita Active',
        desc: 'Buttery flaky pastry filled with minced beef and potatoes, paired with an ice-cold citrus fruit juice box.',
        price: 1400,
        img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
        inStock: true,
        category: 'snacks',
        rating: 4.6,
        prepTime: '10–15 min',
        isPopular: false,
        addonGroups: []
      }
    ]
  }
];

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

function calculateDeliveryFee(distanceKm) {
  // Base ₦400 + ₦150/km rounded to nearest ₦50
  return Math.max(500, Math.round((400 + distanceKm * 150) / 50) * 50);
}

const MANDATORY_SERVICE_FEE = 500; // Fixed ₦500 Platform Service Fee
