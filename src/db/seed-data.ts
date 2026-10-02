import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

/**
 * Loads the marketplace seed dataset out of the browser files.
 *
 * The bundled constants in `public/app/js/data.js` and `service-zones.js` are
 * the original source of truth for restaurants, menus, riders, zones and fee
 * rules. Rather than hand-copying them into TypeScript (which would drift the
 * moment either file changed), the files are evaluated in a throwaway VM
 * context and the values are pulled straight out.
 *
 * The trailing assignment runs in the same script scope as the two files, which
 * matters: a top-level `const` in `vm` does not become a property of the
 * context's global object, so the values have to be captured from inside the
 * script rather than read off the sandbox afterwards.
 */

export type SeedRestaurant = {
  id: string;
  name: string;
  slug: string;
  rating: number;
  reviewsCount: number;
  prepTime: string;
  distanceKm: number;
  deliveryFee: number;
  address: string;
  openingTime?: string;
  closingTime?: string;
  lat: number;
  lng: number;
  open: boolean;
  isVerified: boolean;
  tags: string[];
  category: string;
  isBudget: boolean;
  isRecommended: boolean;
  isPopular: boolean;
  isFast: boolean;
  bannerImg?: string;
  menu: SeedMenuItem[];
};

export type SeedMenuItem = {
  id: string;
  name: string;
  desc?: string;
  /**
   * The single effective price. Present on every dish, even when `priceType` is
   * absent — the bundled data has older dishes that only carry `price`.
   */
  price: number;
  priceType?: string;
  scoopPrice?: number;
  platePrice?: number;
  piecePrice?: number;
  sizes?: { id?: string; name: string; price: number }[];
  compulsoryExtras?: { name: string; price: number }[];
  optionalExtras?: { name: string; price: number }[];
  /**
   * Older dishes describe their extras as customer-facing groups rather than
   * the flat required/optional split, and the two representations coexist in
   * the same file.
   */
  addonGroups?: { title: string; required: boolean; options: { name: string; price: number }[] }[];
  img?: string;
  category: string;
  rating: number;
  prepTime?: string;
  isPopular?: boolean;
  inStock: boolean;
  preorderEnabled?: boolean;
  preorderDate?: string;
  preorderTime?: string;
};

export type SeedRider = {
  id: string;
  publicId?: string;
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
  tripsCount: number;
  avatar: string;
  online: boolean;
  currentLat: number;
  currentLng: number;
};

export type SeedZone = {
  id: string;
  name: string;
  active: boolean;
  state: string;
  lga: string;
  center: [number, number];
  maxDeliveryDistance: number;
  deliveryRules: { baseFee: number; ratePerMeter: number; serviceFee: number };
  operatingHours: { open: string; close: string };
  polygon: [number, number][];
};

export type SeedLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  type: string;
};

export type SeedCategory = { id: string; name: string; icon: string; img: string };

export type MarketplaceSeed = {
  locations: SeedLocation[];
  categories: SeedCategory[];
  restaurants: SeedRestaurant[];
  riders: SeedRider[];
  zones: SeedZone[];
  ogunBoundary: [number, number][];
  deliveryConfig: {
    baseFee: number;
    serviceFee: number;
    ratePerMeter: number;
    minDeliveryFee: number;
  };
  mandatoryServiceFee: number;
};

let cached: MarketplaceSeed | null = null;

export function loadMarketplaceSeed(): MarketplaceSeed {
  if (cached) return cached;

  const jsDir = resolve(process.cwd(), "public", "app", "js");
  const serviceZones = readFileSync(resolve(jsDir, "service-zones.js"), "utf8");
  const data = readFileSync(resolve(jsDir, "data.js"), "utf8");

  // service-zones.js is concatenated first: data.js reads
  // DEFAULT_DELIVERY_FEE_CONFIG to derive MANDATORY_SERVICE_FEE. The reference
  // is guarded by a `typeof` check so either order would run, but loading them
  // in dependency order keeps the derived fee correct.
  const script = [
    serviceZones,
    data,
    "globalThis.__CHOW45_SEED__ = {",
    "  CHOW45_LOCATIONS, CHOW45_CATEGORIES, CHOW45_RESTAURANTS, CHOW45_RIDERS,",
    "  CHOW45_SERVICE_ZONES, OGUN_STATE_BOUNDARY, DEFAULT_DELIVERY_FEE_CONFIG, MANDATORY_SERVICE_FEE,",
    "};",
  ].join("\n");

  const context = { console };
  runInNewContext(script, context, { filename: "chow45-seed.js" });

  const raw = (context as Record<string, any>).__CHOW45_SEED__;
  if (!raw) {
    throw new Error(
      "Could not read the marketplace seed constants out of public/app/js. " +
        "Check that data.js and service-zones.js still declare the expected names.",
    );
  }

  cached = {
    locations: raw.CHOW45_LOCATIONS,
    categories: raw.CHOW45_CATEGORIES,
    restaurants: raw.CHOW45_RESTAURANTS,
    riders: raw.CHOW45_RIDERS,
    zones: raw.CHOW45_SERVICE_ZONES,
    ogunBoundary: raw.OGUN_STATE_BOUNDARY,
    deliveryConfig: raw.DEFAULT_DELIVERY_FEE_CONFIG,
    mandatoryServiceFee: raw.MANDATORY_SERVICE_FEE,
  };

  return cached;
}
