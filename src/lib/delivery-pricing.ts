/**
 * CHOW45 COORDINATE-BASED DELIVERY PRICING ENGINE
 *
 * Implements authoritative geographic distance and delivery pricing calculations
 * based on vendor and customer GPS coordinates, independent of road routing.
 */

export const DELIVERY_PRICING_CONFIG = {
  RATE_PER_KM: 200,
  MINIMUM_DELIVERY_FEE: 200,
  SERVICE_FEE: 400,
  EARTH_RADIUS_METERS: 6371000,
} as const;

/**
 * Calculates great-circle straight-line distance in metres between two lat/lng coordinates
 * using the Haversine formula.
 *
 * Validates coordinate presence, finite number typing, and valid spherical ranges:
 * - Latitude: [-90, 90]
 * - Longitude: [-180, 180]
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const values = [lat1, lon1, lat2, lon2];

  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Invalid delivery coordinates: all coordinates must be finite numbers");
  }

  if (
    lat1 < -90 ||
    lat1 > 90 ||
    lat2 < -90 ||
    lat2 > 90 ||
    lon1 < -180 ||
    lon1 > 180 ||
    lon2 < -180 ||
    lon2 > 180
  ) {
    throw new Error("Coordinates are outside valid ranges: latitude [-90, 90], longitude [-180, 180]");
  }

  // Identical coordinates return 0 metres
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const earthRadius = DELIVERY_PRICING_CONFIG.EARTH_RADIUS_METERS;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const safeA = Math.min(1, Math.max(0, a));
  const distance = 2 * earthRadius * Math.asin(Math.sqrt(safeA));

  return Number.isFinite(distance) ? distance : 0;
}

/**
 * Calculates the delivery fee from straight-line distance in metres.
 *
 * Formula: max(minimumDeliveryFee, ceil((distanceMeters / 1000) * ratePerKilometre))
 */
export function calculateDeliveryFee(
  distanceMeters: number,
  ratePerKilometre: number = DELIVERY_PRICING_CONFIG.RATE_PER_KM,
  minimumDeliveryFee: number = DELIVERY_PRICING_CONFIG.MINIMUM_DELIVERY_FEE
): number {
  if (
    typeof distanceMeters !== "number" ||
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0
  ) {
    throw new Error("Invalid delivery distance: must be a finite, non-negative number");
  }

  return Math.max(
    minimumDeliveryFee,
    Math.ceil((distanceMeters / 1000) * ratePerKilometre)
  );
}

/**
 * Validates arbitrary input to verify whether it represents valid numeric coordinates.
 */
export function validateCoordinates(
  lat: unknown,
  lng: unknown
): { lat: number; lng: number } | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return null;
  }

  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return null;
  }

  return { lat: numLat, lng: numLng };
}

/**
 * Formats distance into a human-readable straight-line label.
 * e.g., "1.50 km (straight-line)" or "850 m (straight-line)".
 */
export function formatDistanceLabel(distanceMeters: number): string {
  const m = Math.max(0, distanceMeters);
  if (m < 1000) {
    return `${Math.round(m)} m (straight-line)`;
  }
  return `${(m / 1000).toFixed(2)} km (straight-line)`;
}

export interface PricingSnapshot {
  vendorCoordinates: { lat: number; lng: number };
  customerCoordinates: { lat: number; lng: number };
  distanceMeters: number;
  distanceLabel: string;
  ratePerKm: number;
  minDeliveryFee: number;
  deliveryFee: number;
  serviceFee: number;
  subtotal: number;
  total: number;
  formula: string;
  calculatedAt: string;
}
