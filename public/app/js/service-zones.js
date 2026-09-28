/**
 * CHOW45 SERVICE ZONES & DELIVERY GEOGRAPHY
 * Configurable geographic delivery zones around Ogun State campuses.
 * Each zone is defined by a closed polygon of [lng, lat] coordinates.
 *
 * Responsibilities:
 *  - Point-in-polygon service availability validation (COORDINATE based, not string based)
 *  - Ogun State boundary check (coordinates, not "address contains Ogun")
 *  - Zone config: active flag, operating hours, max delivery distance, delivery rules
 *  - Delivery fee engine: fee = baseFee + (routeDistanceMeters * ratePerMeter)
 *
 * The polygons below are admin-editable through the Admin → Service Areas tool.
 */

const CHOW45_SERVICE_ZONES = [
  {
    id: 'ibogun-campus',
    name: 'Ibogun Campus',
    active: true,
    state: 'Ogun',
    lga: 'Ifo LGA',
    center: [3.3900, 6.7200],
    maxDeliveryDistance: 4000, // meters
    deliveryRules: {
      baseFee: 300,
      ratePerMeter: 0.15,
      serviceFee: 400
    },
    operatingHours: { open: '08:00', close: '23:00' },
    polygon: [
      [3.3600, 6.6950],
      [3.4200, 6.6950],
      [3.4200, 6.7500],
      [3.3600, 6.7500],
      [3.3600, 6.6950]
    ]
  },
  {
    id: 'sagamu-campus',
    name: 'Sagamu Campus',
    active: true,
    state: 'Ogun',
    lga: 'Sagamu LGA',
    center: [3.6139, 6.8270],
    maxDeliveryDistance: 5000,
    deliveryRules: {
      baseFee: 300,
      ratePerMeter: 0.15,
      serviceFee: 400
    },
    operatingHours: { open: '08:00', close: '23:00' },
    polygon: [
      [3.5700, 6.7950],
      [3.6300, 6.7950],
      [3.6300, 6.8450],
      [3.5700, 6.8450],
      [3.5700, 6.7950]
    ]
  },
  {
    id: 'ago-iwoye',
    name: 'Ago-Iwoye (OOU Main Campus)',
    active: true,
    state: 'Ogun',
    lga: 'Ijebu North LGA',
    center: [3.6545, 6.8482],
    maxDeliveryDistance: 4000,
    deliveryRules: {
      baseFee: 300,
      ratePerMeter: 0.15,
      serviceFee: 400
    },
    operatingHours: { open: '08:00', close: '23:00' },
    polygon: [
      [3.6300, 6.8350],
      [3.6800, 6.8350],
      [3.6800, 6.8650],
      [3.6300, 6.8650],
      [3.6300, 6.8350]
    ]
  },
  {
    id: 'oou-area',
    name: 'OOU Delivery Belt',
    active: true,
    state: 'Ogun',
    lga: 'Sagamu LGA',
    center: [3.6450, 6.8450],
    maxDeliveryDistance: 6000,
    deliveryRules: {
      baseFee: 300,
      ratePerMeter: 0.15,
      serviceFee: 400
    },
    operatingHours: { open: '07:00', close: '00:00' },
    polygon: [
      [3.6100, 6.8200],
      [3.7000, 6.8200],
      [3.7000, 6.8800],
      [3.6100, 6.8800],
      [3.6100, 6.8200]
    ]
  },
  {
    id: 'ogitech-studio',
    name: 'OGITECH Creative Studio Hub',
    active: false,
    state: 'Ogun',
    lga: 'Ifo LGA',
    center: [3.3860, 6.7210],
    maxDeliveryDistance: 3000,
    deliveryRules: {
      baseFee: 300,
      ratePerMeter: 0.15,
      serviceFee: 400
    },
    operatingHours: { open: '08:00', close: '22:00' },
    polygon: [
      [3.3680, 6.7060],
      [3.4040, 6.7060],
      [3.4040, 6.7360],
      [3.3680, 6.7360],
      [3.3680, 6.7060]
    ]
  }
];

/**
 * Coarse Ogun State outer boundary (coordinate based).
 * Used to distinguish "inside Ogun but outside an active zone" from
 * "completely outside Ogun State".
 */
const OGUN_STATE_BOUNDARY = [
  [2.6800, 6.1000],
  [4.1000, 6.1000],
  [4.1000, 7.4000],
  [2.6800, 7.4000],
  [2.6800, 6.1000]
];

/**
 * Default delivery fee configuration. All values are admin-configurable
 * via the Admin → Delivery Settings panel and persisted in chowStore state.
 *
 * deliveryFee = baseFee + (routeDistanceMeters * ratePerMeter)
 * serviceFee  = flat mandatory per parent order
 */
const DEFAULT_DELIVERY_FEE_CONFIG = {
  baseFee: 300,
  serviceFee: 400,
  ratePerMeter: 0.15,
  minDeliveryFee: 300
};

// -------------------------------------------------------------
// GEOMETRY HELPERS
// -------------------------------------------------------------

/**
 * Ray-casting point-in-polygon test.
 * @param {[number, number]} point [lng, lat]
 * @param {Array<[number, number]>} polygon closed ring of [lng, lat]
 * @returns {boolean}
 */
function isPointInPolygon(point, polygon) {
  const x = point[0];
  const y = point[1];
  let inside = false;
  const ring = polygon || [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.0000001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Haversine distance between two [lng, lat] / {lng, lat} points in meters.
 */
function haversineDistanceMeters(a, b) {
  const lat1 = a.lat !== undefined ? a.lat : a[1];
  const lng1 = a.lng !== undefined ? a.lng : a[0];
  const lat2 = b.lat !== undefined ? b.lat : b[1];
  const lng2 = b.lng !== undefined ? b.lng : b[0];
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.sin(dLng / 2) ** 2;
  const a1 = Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  return 2 * R * Math.asin(Math.sqrt(s1 + a1 * s2));
}

/**
 * Human readable distance: "850 m" / "2.4 km".
 */
function formatDistanceMeters(meters) {
  const m = Math.max(0, Math.round(meters || 0));
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`;
}

/**
 * Grouped naira amount: "₦12,500".
 *
 * Money fields reach these renderers from seeded state, localStorage and the
 * database, so any of them can be missing. Formatting them with a bare
 * `.toLocaleString()` throws a TypeError that aborts the whole render (and
 * therefore the surrounding `.map`), which is why every call site goes through
 * this helper instead.
 */
function formatNaira(amount) {
  const n = Number(amount);
  return `₦${(Number.isFinite(n) ? n : 0).toLocaleString()}`;
}

/**
 * Human readable duration: "6 min" / "1 hr 5 min".
 */
function formatDurationSeconds(seconds) {
  const mins = Math.max(1, Math.round((seconds || 0) / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// -------------------------------------------------------------
// AVAILABILITY ENGINE (COORDINATE BASED - NOT STRING BASED)
// -------------------------------------------------------------

/**
 * Find the zone whose polygon contains the given point.
 * @param {{lng:number, lat:number}} point
 * @returns {object|null} zone definition (active or not)
 */
function findZoneForPoint(point) {
  const coord = [point.lng, point.lat];
  for (const zone of CHOW45_SERVICE_ZONES) {
    if (isPointInPolygon(coord, zone.polygon)) {
      return zone;
    }
  }
  return null;
}

/**
 * Determine whether a point is inside Ogun State's outer boundary.
 */
function isPointInOgun(point) {
  return isPointInPolygon([point.lng, point.lat], OGUN_STATE_BOUNDARY);
}

/**
 * Resolve delivery availability for a coordinate.
 * @param {{lng:number, lat:number}} point
 * @returns {{status:'available'|'ogun_outside_zone'|'outside_ogun', inOgun:boolean, zone:object|null, zoneActive:boolean}}
 */
function getServiceAvailability(point) {
  const inOgun = isPointInOgun(point);
  const zone = findZoneForPoint(point);

  if (zone && zone.active) {
    return { status: 'available', inOgun: true, zone, zoneActive: true };
  }
  if (zone && !zone.active) {
    return { status: 'ogun_outside_zone', inOgun: true, zone, zoneActive: false };
  }
  if (inOgun) {
    return { status: 'ogun_outside_zone', inOgun: true, zone: null, zoneActive: false };
  }
  return { status: 'outside_ogun', inOgun: false, zone: null, zoneActive: false };
}

/**
 * Does the zone currently accept orders based on operating hours?
 */
function isZoneOpen(zone, date = new Date()) {
  if (!zone || !zone.operatingHours) return true;
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const { open, close } = zone.operatingHours;
  if (open <= close) return hm >= open && hm <= close;
  return hm >= open || hm <= close; // overnight window
}

// -------------------------------------------------------------
// DELIVERY FEE ENGINE
// -------------------------------------------------------------

/**
 * Compute the delivery fee from actual route distance.
 *   deliveryFee = baseFee + (routeDistanceMeters * ratePerMeter)
 * @param {number} routeDistanceMeters
 * @param {object} [config] overrides for baseFee / ratePerMeter / minDeliveryFee
 * @returns {number} fee in Naira
 */
function calculateDeliveryFee(routeDistanceMeters, config = {}) {
  const baseFee = config.baseFee !== undefined ? config.baseFee : DEFAULT_DELIVERY_FEE_CONFIG.baseFee;
  const rate = config.ratePerMeter !== undefined ? config.ratePerMeter : DEFAULT_DELIVERY_FEE_CONFIG.ratePerMeter;
  const minFee = config.minDeliveryFee !== undefined ? config.minDeliveryFee : DEFAULT_DELIVERY_FEE_CONFIG.minDeliveryFee;
  const distance = Math.max(0, routeDistanceMeters || 0);
  const fee = baseFee + distance * rate;
  return Math.max(minFee, Math.round(fee));
}

/**
 * Build a delivery quote given route + zone + config.
 * @param {number} routeDistanceMeters
 * @param {number} durationSeconds
 * @param {object} [zone]
 * @param {object} [config]
 */
function buildDeliveryQuote(routeDistanceMeters, durationSeconds, zone, config = {}) {
  const feeConfig = {
    baseFee: zone && zone.deliveryRules ? (zone.deliveryRules.baseFee !== undefined ? zone.deliveryRules.baseFee : DEFAULT_DELIVERY_FEE_CONFIG.baseFee) : (config.baseFee !== undefined ? config.baseFee : DEFAULT_DELIVERY_FEE_CONFIG.baseFee),
    ratePerMeter: zone && zone.deliveryRules ? (zone.deliveryRules.ratePerMeter !== undefined ? zone.deliveryRules.ratePerMeter : DEFAULT_DELIVERY_FEE_CONFIG.ratePerMeter) : (config.ratePerMeter !== undefined ? config.ratePerMeter : DEFAULT_DELIVERY_FEE_CONFIG.ratePerMeter),
    serviceFee: zone && zone.deliveryRules ? (zone.deliveryRules.serviceFee !== undefined ? zone.deliveryRules.serviceFee : DEFAULT_DELIVERY_FEE_CONFIG.serviceFee) : (config.serviceFee !== undefined ? config.serviceFee : DEFAULT_DELIVERY_FEE_CONFIG.serviceFee),
    minDeliveryFee: DEFAULT_DELIVERY_FEE_CONFIG.minDeliveryFee
  };
  const deliveryFee = calculateDeliveryFee(routeDistanceMeters, feeConfig);

  return {
    distanceMeters: Math.round(routeDistanceMeters || 0),
    durationSeconds: Math.round(durationSeconds || 0),
    deliveryFee,
    deliveryFeeLabel: formatNaira(deliveryFee),
    distanceLabel: formatDistanceMeters(routeDistanceMeters),
    durationLabel: formatDurationSeconds(durationSeconds),
    baseFee: feeConfig.baseFee,
    serviceFee: feeConfig.serviceFee,
    ratePerMeter: feeConfig.ratePerMeter,
    zoneId: zone ? zone.id : null,
    zoneName: zone ? zone.name : null,
    maxDeliveryDistance: zone ? zone.maxDeliveryDistance : null,
    withinMaxDistance: zone ? routeDistanceMeters <= zone.maxDeliveryDistance : true
  };
}