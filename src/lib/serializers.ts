import type {
  DeliveryConfig,
  DeliveryLocation,
  MenuExtra,
  MenuItem,
  MenuItemSize,
  Order,
  OrderEvent,
  OrderItem,
  Rider,
  ServiceZone,
  Vendor,
  Cart,
  CartItem,
  Address,
  Favorite,
  VendorApplication,
  VendorWallet,
  VendorWithdrawal,
  Dispute,
} from "@/db";

/**
 * Converts database rows into the shapes the browser client already expects.
 *
 * The legacy SPA in `public/app/js` reads a flat `state` object with
 * snake-free, short keys (`restaurants[].menu[]`, `open`, `lat`, `bannerImg`).
 * Rather than rewriting every renderer in `customer.js`, `vendor.js`,
 * `rider.js` and `admin.js`, the rows are shaped back into that contract here.
 *
 * Two conversions matter and are easy to get wrong:
 *  - `numeric` columns arrive from pg as strings; the client does arithmetic on
 *    coordinates and would concatenate instead of adding.
 *  - the storefront's public id is `vendors.storeId`, not `vendors.id`, so it
 *    is emitted as `id` to keep every `store.id === '...'` comparison working.
 */

/** pg returns `numeric` as a string to protect precision. */
export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numOr(value: string | number | null | undefined, fallback: number): number {
  return num(value) ?? fallback;
}

export type ClientAddon = { name: string; price: number };

export type ClientMenuItem = {
  id: string;
  name: string;
  desc: string;
  price: number;
  priceType: string;
  scoopPrice: number;
  platePrice: number;
  piecePrice: number;
  sizes: { id: string; name: string; price: number }[];
  compulsoryExtras: ClientAddon[];
  optionalExtras: ClientAddon[];
  /**
   * The customer customiser renders from `addonGroups`, not from the flat
   * required/optional lists, so the split is regrouped on the way out.
   */
  addonGroups: { title: string; required: boolean; options: ClientAddon[] }[];
  img: string | null;
  category: string;
  status: string;
  inStock: boolean;
  isPublished: boolean;
  preorderEnabled: boolean;
  preorderDate: string;
  preorderTime: string;
  vendorId: number | null;
};

export function serializeMenuItem(
  item: MenuItem,
  sizes: MenuItemSize[] = [],
  extras: MenuExtra[] = [],
): ClientMenuItem {
  const compulsory = extras.filter((e) => e.extraType === "REQUIRED");
  const optional = extras.filter((e) => e.extraType === "OPTIONAL");

  const addonGroups: ClientMenuItem["addonGroups"] = [];
  if (compulsory.length > 0) {
    addonGroups.push({
      title: "Choose compulsory extra",
      required: true,
      options: compulsory.map(toAddon),
    });
  }
  if (optional.length > 0) {
    addonGroups.push({
      title: "Optional extras",
      required: false,
      options: optional.map(toAddon),
    });
  }

  return {
    id: item.id,
    name: item.name,
    desc: item.description ?? "",
    price: item.price,
    priceType: item.priceType,
    scoopPrice: item.scoopPrice ?? 0,
    platePrice: item.platePrice ?? 0,
    piecePrice: item.piecePrice ?? 0,
    sizes: sizes
      .filter((s) => s.isAvailable)
      .map((s) => ({ id: s.id, name: s.name, price: s.price })),
    compulsoryExtras: compulsory.map(toAddon),
    optionalExtras: optional.map(toAddon),
    addonGroups,
    img: item.imageUrl,
    category: item.category ?? "rice",
    status: item.status,
    inStock: item.status === "AVAILABLE" || item.status === "PREORDER",
    isPublished: item.isPublished,
    preorderEnabled: item.preorderEnabled,
    preorderDate: item.preorderDate ?? "",
    preorderTime: item.preorderTime ?? "",
    vendorId: item.vendorId,
  };
}

function toAddon(extra: MenuExtra): ClientAddon {
  return { name: extra.name, price: extra.price };
}

export type ClientStore = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  cuisine: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  rating: number;
  reviewsCount: number;
  prepTime: string;
  deliveryFee: number;
  address: string;
  openingTime: string;
  closingTime: string;
  lat: number;
  lng: number;
  open: boolean;
  isVerified: boolean;
  isBudget: boolean;
  isRecommended: boolean;
  isPopular: boolean;
  isFast: boolean;
  category: string;
  tags: string[];
  bannerImg: string | null;
  source: string;
  menu: ClientMenuItem[];
};

export function serializeStore(vendor: Vendor, menu: ClientMenuItem[] = []): ClientStore {
  return {
    id: vendor.storeId,
    name: vendor.businessName,
    slug: vendor.slug,
    description: vendor.description ?? "",
    status: vendor.status,
    cuisine: vendor.cuisine,
    ownerName: vendor.ownerName,
    ownerPhone: vendor.ownerPhone,
    rating: vendor.rating,
    reviewsCount: vendor.reviewsCount,
    prepTime: vendor.prepTime ?? "20–30 min",
    deliveryFee: vendor.deliveryFee,
    address: vendor.address ?? "",
    openingTime: vendor.openingTime ?? "",
    closingTime: vendor.closingTime ?? "",
    lat: numOr(vendor.latitude, 0),
    lng: numOr(vendor.longitude, 0),
    open: vendor.isOpen,
    isVerified: vendor.isVerified,
    isBudget: vendor.isBudget,
    isRecommended: vendor.isRecommended,
    isPopular: vendor.isPopular,
    isFast: vendor.isFast,
    category: vendor.category ?? "rice",
    tags: vendor.tags ?? [],
    bannerImg: vendor.bannerImage ?? vendor.image,
    source: vendor.source,
    menu,
  };
}

export function serializeZone(zone: ServiceZone) {
  return {
    id: zone.id,
    name: zone.name,
    active: zone.isActive,
    state: zone.state ?? "",
    lga: zone.lga ?? "",
    center: zone.center,
    maxDeliveryDistance: zone.maxDeliveryDistance,
    deliveryRules: zone.deliveryRules,
    operatingHours: zone.operatingHours,
    polygon: zone.polygon,
  };
}

export function serializeLocation(loc: DeliveryLocation) {
  return {
    id: loc.id,
    name: loc.name,
    lat: numOr(loc.latitude, 0),
    lng: numOr(loc.longitude, 0),
    city: loc.city ?? "",
    type: loc.type ?? "Other",
  };
}

export function serializeConfig(config: DeliveryConfig | undefined) {
  return {
    baseFee: config?.baseFee ?? 300,
    serviceFee: config?.serviceFee ?? 400,
    ratePerMeter: config?.ratePerMeter ?? 0.15,
    minDeliveryFee: config?.minDeliveryFee ?? 300,
  };
}

export function serializeRider(rider: Rider) {
  return {
    id: rider.id,
    name: rider.name,
    phone: rider.phone ?? "",
    vehicle: rider.vehicle ?? "",
    rating: rider.rating,
    tripsCount: rider.tripsCount,
    avatar: rider.avatar,
    online: rider.isOnline,
    currentLat: num(rider.currentLat),
    currentLng: num(rider.currentLng),
  };
}

export function serializeOrder(
  order: Order,
  items: OrderItem[] = [],
  events: OrderEvent[] = [],
) {
  return {
    id: order.id,
    storeId: order.storeId,
    storeName: order.storeName,
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? "",
    deliveryAddress: order.deliveryAddress,
    deliveryNotes: order.deliveryNotes ?? "",
    deliveryLocation: order.deliveryLocation ?? null,
    paymentMethod: order.paymentMethod ?? "",
    subtotal: order.subtotal,
    serviceFee: order.serviceFee,
    deliveryFee: order.deliveryFee,
    total: order.total,
    status: order.status,
    riderId: order.riderId,
    riderName: order.riderName,
    pin: order.pin,
    routeDistanceMeters: order.routeDistanceMeters,
    estimatedDurationSeconds: order.estimatedDurationSeconds,
    createdAt: order.createdAt.toISOString(),
    items: items.map((i) => ({
      dishId: i.menuItemId,
      name: i.name,
      qty: i.qty,
      unitPrice: i.unitPrice,
      itemTotal: i.itemTotal,
      selectedAddons: i.selectedAddons ?? [],
    })),
    history: events.map((e) => ({
      status: e.status,
      timestamp: e.createdAt.toISOString(),
      note: e.note ?? e.status,
      actor: e.actor,
    })),
    review:
      order.rating != null
        ? {
            rating: order.rating,
            comment: order.reviewComment ?? "",
            submittedAt: order.reviewedAt?.toISOString() ?? null,
          }
        : undefined,
  };
}

/**
 * The cart points at a vendor row, but the client keys its state by the public
 * `storeId` string and shows the store name in the basket header, so the store
 * is resolved by the caller and passed in. A cart with no items has no store,
 * which is what the client checks to decide whether to show the basket at all.
 */
export function serializeCart(cart: Cart | null, items: CartItem[], store: ClientStore | null = null) {
  if (!cart) {
    return { id: null, vendorId: null, storeId: null, storeName: null, items: [] };
  }

  return {
    id: cart.id,
    vendorId: cart.vendorId,
    storeId: store?.id ?? null,
    storeName: store?.name ?? null,
    items: items.map((i) => ({
      dishId: i.menuItemId,
      name: i.name,
      img: i.img,
      price: i.unitPrice,
      qty: i.qty,
      itemTotal: i.itemTotal,
      selectedAddons: i.selectedAddons ?? [],
    })),
  };
}

export function serializeAddress(address: Address) {
  return {
    id: address.id,
    label: address.label ?? "",
    address: address.address,
    formattedAddress: address.formattedAddress ?? address.address,
    latitude: num(address.latitude),
    longitude: num(address.longitude),
    lga: address.lga ?? "",
    state: address.state ?? "",
    placeId: address.placeId,
    deliveryInstructions: address.deliveryInstructions ?? "",
    isDefault: address.isDefault,
  };
}

export function serializeFavorites(rows: Favorite[]) {
  return {
    foods: rows.filter((r) => r.targetType === "food").map((r) => r.targetId),
    stores: rows.filter((r) => r.targetType === "store").map((r) => r.targetId),
  };
}

export function serializeApplication(app: VendorApplication) {
  return {
    id: app.id,
    applicationId: app.applicationId,
    businessName: app.businessName,
    name: app.businessName,
    ownerName: app.ownerName ?? "",
    ownerEmail: app.ownerEmail ?? "",
    ownerPhone: app.ownerPhone ?? "",
    phone: app.ownerPhone ?? "",
    address: app.address ?? "",
    location: app.address ?? "",
    lga: app.lga ?? "",
    pickupLat: num(app.pickupLat),
    pickupLng: num(app.pickupLng),
    cuisine: app.cuisine ?? "",
    openingTime: app.openingTime ?? "",
    closingTime: app.closingTime ?? "",
    coverImg: app.coverImage,
    status: app.status,
    rejectionReason: app.rejectionReason,
    vendorId: app.vendorId,
    appliedAt: app.createdAt.toISOString(),
    reviewedAt: app.reviewedAt?.toISOString() ?? null,
  };
}

export function serializeWallet(wallet: VendorWallet | undefined) {
  return {
    available: wallet?.available ?? 0,
    processing: wallet?.processing ?? 0,
  };
}

export function serializeWithdrawal(w: VendorWithdrawal) {
  return {
    id: w.id,
    amount: w.amount,
    bankName: w.bankName ?? "",
    accountNumber: w.accountNumber ?? "",
    status: w.status,
    requestedAt: w.createdAt.toISOString(),
    expectedPayDate: w.expectedPayDate?.toISOString() ?? null,
    paidOutAt: w.paidOutAt?.toISOString() ?? null,
  };
}

export function serializeDispute(dispute: Dispute) {
  return {
    id: dispute.id,
    orderId: dispute.orderId,
    reason: dispute.reason,
    details: dispute.details ?? "",
    status: dispute.status,
    resolution: dispute.resolution ?? undefined,
    createdAt: dispute.createdAt.toISOString(),
  };
}
