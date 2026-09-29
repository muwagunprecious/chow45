import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  addresses,
  cartItems,
  carts,
  deliveryConfigs,
  disputes,
  favorites,
  menuExtras,
  menuItemSizes,
  menuItems,
  orders,
  orderEvents,
  orderItems,
  platformLedgers,
  riders,
  serviceZones,
  vendorApplications,
  vendorWallets,
  vendorWithdrawals,
  vendors,
} from "@/db";
import { ORDER_STATUSES } from "@/lib/order-status";
import { optionalText, readClientId, toCoord, toLat } from "@/lib/validation";

/**
 * Moves the legacy `chow45_marketplace_state_v2` blob into Postgres.
 *
 * The blob is one giant JSON object the browser kept as its single source of
 * truth. Every table in `src/db/schema` exists because of it — the schema
 * comments name the state field each one replaces — so this module is the
 * bridge that finally drains it.
 *
 * Three things shape the approach:
 *
 *  - **It runs as a dry run by default.** An import rewrites the catalog and
 *    the caller's own orders, so `commit` has to be asked for explicitly.
 *  - **Reads and writes share one code path.** The `commit` flag guards every
 *    write and nothing else, so the dry run reports exactly what the real run
 *    would do instead of drifting from it.
 *  - **Rows that cannot be placed are reported, not forced.** Foreign keys are
 *    checked before an insert: an order pointing at a rider that was never
 *    imported, or a dispute pointing at a missing order, is skipped with a
 *    reason rather than aborting the whole import or silently nulling the
 *    relationship.
 *
 * Idempotency is by natural key, so re-running converges instead of
 * duplicating: `vendors.storeId`, `menu_items.id`, `service_zones.id`,
 * `orders.id`, `riders.id`, `vendor_applications.applicationId` and so on.
 */

/** Either the pool or a transaction; the query surface used here is identical. */
export type Executor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export type ImportScope = "catalog" | "user" | "vendor";

export type ImportSkipped = { collection: string; id: string; reason: string };

export type ImportReport = {
  mode: "dry-run" | "applied";
  /** Rows written, or that would be written on a dry run, per table. */
  counts: Record<string, number>;
  skipped: ImportSkipped[];
  warnings: string[];
};

const SCOPES: ImportScope[] = ["catalog", "user", "vendor"];

const KNOWN_STATUSES = new Set<string>(ORDER_STATUSES);

/** Bumps a per-table tally. Every import step reports through one of these. */
type Counter = (table: string, by?: number) => void;

type Json = Record<string, unknown>;

export async function importLocalState(
  blob: unknown,
  userId: number,
  commit: boolean,
  scopes: ImportScope[] = SCOPES,
  ex: Executor = db,
): Promise<ImportReport> {
  const state = asRecord(blob);
  const report: ImportReport = {
    mode: commit ? "applied" : "dry-run",
    counts: {},
    skipped: [],
    warnings: [],
  };

  if (state === null) {
    report.warnings.push("Request body had no readable `state` object; nothing to import.");
    return report;
  }

  const on = (scope: ImportScope) => scopes.includes(scope);
  const now = new Date();

  // Orders, carts and applications all reference storefronts by `storeId`. If
  // the catalog is out of scope those references cannot be resolved, so say so
  // up front rather than letting the caller read the skips and work it out.
  if (!on("catalog") && (on("user") || on("vendor"))) {
    report.warnings.push(
      'The "catalog" scope was excluded, so storefronts in this blob were not imported. Any store already in the database still resolves; one that is not will leave orders, carts and applications unattributed.',
    );
  }

  const count = (table: string, by = 1) => {
    report.counts[table] = (report.counts[table] ?? 0) + by;
  };

  /**
   * Importing the catalog first means every later step can resolve the
   * storefronts, riders and zones the per-user rows point at, instead of
   * dropping those references as dangling.
   */
  const vendorIdsByStoreId = new Map<string, number>();

  if (on("catalog")) {
    await importDeliveryConfig(state, ex, commit, count);
    await importZones(state, ex, commit, count, report);
    await importRiders(state, ex, commit, count, report);
    await importStores(state, ex, commit, now, count, report, vendorIdsByStoreId);
  }

  if (on("user")) {
    await importOrders(state, userId, ex, commit, now, count, report, vendorIdsByStoreId);
    await importCart(state, userId, ex, commit, count, report, vendorIdsByStoreId);
    await importAddresses(state, userId, ex, commit, count, report);
    await importFavorites(state, userId, ex, commit, count, report);
  }

  if (on("vendor")) {
    await importApplications(state, userId, ex, commit, now, count, report, vendorIdsByStoreId);
    await importVendorFinance(state, userId, ex, commit, count, report);
    await importDisputes(state, userId, ex, commit, count, report);
  }

  await recomputeLedger(ex, commit, count, report, state);

  return report;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * `state.deliveryConfig` -> `delivery_configs` (single row, id pinned to 1).
 */
async function importDeliveryConfig(
  state: Json,
  ex: Executor,
  commit: boolean,
  count: Counter,
) {
  const cfg = asRecord(state.deliveryConfig);
  if (cfg === null) return;

  const values = {
    baseFee: money(cfg.baseFee),
    serviceFee: money(cfg.serviceFee),
    ratePerMeter: rate(cfg.ratePerMeter),
    minDeliveryFee: money(cfg.minDeliveryFee),
    updatedAt: new Date(),
  };

  if (commit) {
    await ex
      .insert(deliveryConfigs)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: deliveryConfigs.id, set: values });
  }
  count("deliveryConfigs");
}

/**
 * `state.serviceZones` -> `service_zones`, preserving the array order as
 * `sortOrder` because the admin zone list is rendered in that order.
 *
 * Polygons are `[lng, lat]` pairs and are stored as-is. Swapping the pair order
 * silently inverts every zone, so the values are passed through untouched
 * rather than being normalised.
 */
async function importZones(
  state: Json,
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
) {
  const zones = asArray(state.serviceZones);

  for (const [index, raw] of zones.entries()) {
    const zone = asRecord(raw);
    if (zone === null) continue;

    const id = readClientId(zone.id);
    if (id === null) {
      report.skipped.push({ collection: "serviceZones", id: String(zone.id), reason: "Unusable id." });
      continue;
    }

    const center = asPair(zone.center);
    const rules = asRecord(zone.deliveryRules);
    const hours = asRecord(zone.operatingHours);

    if (center === null || rules === null || hours === null) {
      report.skipped.push({
        collection: "serviceZones",
        id,
        reason: "Zone is missing a well-formed center, deliveryRules or operatingHours.",
      });
      continue;
    }

    const polygon = asPairs(zone.polygon);
    if (polygon === null) {
      report.skipped.push({ collection: "serviceZones", id, reason: "Polygon coordinates are malformed." });
      continue;
    }

    const values = {
      name: optionalText(zone.name, 255) ?? id,
      isActive: flag(zone.active, true),
      state: optionalText(zone.state, 100),
      lga: optionalText(zone.lga, 100),
      center,
      maxDeliveryDistance: Math.max(0, money(zone.maxDeliveryDistance, 3000)),
      deliveryRules: {
        baseFee: money(rules.baseFee, 300),
        ratePerMeter: rate(rules.ratePerMeter, 0.15),
        serviceFee: money(rules.serviceFee, 400),
      },
      operatingHours: {
        open: String(hours.open ?? "08:00"),
        close: String(hours.close ?? "23:00"),
      },
      polygon,
      sortOrder: index,
      updatedAt: new Date(),
    };

    if (commit) {
      await ex
        .insert(serviceZones)
        .values({ id, ...values })
        .onConflictDoUpdate({ target: serviceZones.id, set: values });
    }
    count("serviceZones");
  }
}

/**
 * `state.riders` -> `riders`.
 *
 * The blob uses `online` while some saved states carry `isOnline`, so both are
 * accepted. `userId` is left alone: it is the link to a real signed-up rider
 * and the blob has no such information.
 */
async function importRiders(
  state: Json,
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
) {
  for (const raw of asArray(state.riders)) {
    const rider = asRecord(raw);
    if (rider === null) continue;

    const id = readClientId(rider.id);
    if (id === null) {
      report.skipped.push({ collection: "riders", id: String(rider.id), reason: "Unusable id." });
      continue;
    }

    const values = {
      name: optionalText(rider.name, 255) ?? id,
      phone: optionalText(rider.phone, 20),
      vehicle: optionalText(rider.vehicle, 255),
      avatar: optionalText(rider.avatar, 2000),
      rating: rating(rider.rating),
      tripsCount: money(rider.tripsCount),
      isOnline: flag(rider.isOnline ?? rider.online, false),
      isAvailable: flag(rider.isAvailable ?? rider.online ?? rider.isOnline, false),
      currentLat: toCoord(rider.currentLat),
      currentLng: toCoord(rider.currentLng),
      updatedAt: new Date(),
    };

    if (commit) {
      await ex
        .insert(riders)
        .values({ id, ...values })
        .onConflictDoUpdate({ target: riders.id, set: values });
    }
    count("riders");
  }
}

/**
 * `state.restaurants` -> `vendors`, `menu_items`, `menu_item_sizes`,
 * `menu_extras`.
 *
 * Sizes and extras are deleted and re-inserted per dish rather than upserted.
 * They are pure children of the dish with nothing referencing them, so
 * replacing the set is what makes a re-run converge; an upsert would need ids
 * synthesised from names and would still leave orphans behind.
 */
async function importStores(
  state: Json,
  ex: Executor,
  commit: boolean,
  now: Date,
  count: Counter,
  report: ImportReport,
  vendorIdsByStoreId: Map<string, number>,
) {
  const stores = asArray(state.restaurants);

  // `vendors.slug` is unique independently of `storeId`, and the client only
  // ever set `slug` on some storefronts, so slugs are claimed one at a time.
  const takenSlugs = new Map<string, string>();
  for (const row of await ex.select({ id: vendors.id, storeId: vendors.storeId, slug: vendors.slug }).from(vendors)) {
    takenSlugs.set(row.slug, row.storeId);
  }

  for (const raw of stores) {
    const store = asRecord(raw);
    if (store === null) continue;

    const storeId = readClientId(store.id);
    if (storeId === null) {
      report.skipped.push({ collection: "vendors", id: String(store.id), reason: "Unusable storeId." });
      continue;
    }

    const businessName = optionalText(store.name, 255);
    if (businessName === null) {
      report.skipped.push({ collection: "vendors", id: storeId, reason: "Store has no name." });
      continue;
    }

    const slug = claimSlug(takenSlugs, storeId, optionalText(store.slug, 255) ?? businessName);

    const values = {
      slug,
      businessName,
      description: optionalText(store.desc ?? store.description, 2000),
      cuisine: optionalText(store.cuisine, 100),
      ownerName: optionalText(store.ownerName, 255),
      ownerPhone: optionalText(store.ownerPhone, 20),
      image: optionalText(store.img, 2000),
      bannerImage: optionalText(store.bannerImg ?? store.bannerImage, 2000),
      rating: rating(store.rating),
      reviewsCount: money(store.reviewsCount),
      prepTime: optionalText(store.prepTime, 50),
      deliveryFee: money(store.deliveryFee),
      openingTime: optionalText(store.openingTime, 50),
      closingTime: optionalText(store.closingTime, 50),
      latitude: toLat(store.lat),
      longitude: toCoord(store.lng ?? store.lon),
      address: optionalText(store.address, 2000),
      isOpen: flag(store.open, true),
      isVerified: flag(store.isVerified, false),
      isBudget: flag(store.isBudget, false),
      isRecommended: flag(store.isRecommended, false),
      isPopular: flag(store.isPopular, false),
      isFast: flag(store.isFast, false),
      category: optionalText(store.category, 100),
      tags: asStrings(store.tags),
      updatedAt: now,
    };

    // `status` and `source` are only set on first insert. Overwriting them on a
    // re-run would un-approve a real vendor who signed up for a seeded store.
    let vendorId: number;
    if (commit) {
      const existing = await ex
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.storeId, storeId))
        .limit(1);

      if (existing[0]) {
        await ex.update(vendors).set(values).where(eq(vendors.id, existing[0].id));
        vendorId = existing[0].id;
      } else {
        const [inserted] = await ex
          .insert(vendors)
          .values({ storeId, status: "approved", source: "import", ...values })
          .returning({ id: vendors.id });
        vendorId = inserted.id;
      }
    } else {
      const existing = await ex
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.storeId, storeId))
        .limit(1);
      vendorId = existing[0]?.id ?? 0;
    }

    vendorIdsByStoreId.set(storeId, vendorId);
    count("vendors");

    await importMenu(storeId, vendorId, store, ex, commit, now, count, report);
  }
}

async function importMenu(
  storeId: string,
  vendorId: number,
  store: Json,
  ex: Executor,
  commit: boolean,
  now: Date,
  count: Counter,
  report: ImportReport,
) {
  for (const raw of asArray(store.menu)) {
    const dish = asRecord(raw);
    if (dish === null) continue;

    const dishId = readClientId(dish.id);
    if (dishId === null) {
      report.skipped.push({ collection: "menuItems", id: String(dish.id), reason: "Unusable dish id." });
      continue;
    }

    // `menu_items.id` is the primary key rather than a surrogate, so an id
    // already held by a different storefront cannot be adopted: doing so would
    // move the dish to the wrong vendor and rewrite that vendor's menu.
    const owner = await ex
      .select({ vendorId: menuItems.vendorId })
      .from(menuItems)
      .where(eq(menuItems.id, dishId))
      .limit(1);
    if (owner[0] && owner[0].vendorId !== vendorId) {
      report.skipped.push({
        collection: "menuItems",
        id: dishId,
        reason: `Dish id is already used by another storefront (${storeId}).`,
      });
      continue;
    }

    const name = optionalText(dish.name, 255);
    if (name === null) {
      report.skipped.push({ collection: "menuItems", id: dishId, reason: "Dish has no name." });
      continue;
    }

    const scoopPrice = nullableMoney(dish.scoopPrice);
    const platePrice = nullableMoney(dish.platePrice);
    const piecePrice = nullableMoney(dish.piecePrice);

    const values = {
      vendorId,
      name,
      description: optionalText(dish.desc ?? dish.description, 2000),
      imageUrl: optionalText(dish.img ?? dish.imageUrl, 2000),
      category: optionalText(dish.category, 100),
      priceType: priceTypeOf(dish),
      price: money(dish.price ?? platePrice ?? piecePrice ?? 0),
      scoopPrice,
      platePrice,
      piecePrice,
      status: dishStatus(dish),
      isPublished: flag(dish.isPublished, true),
      preorderEnabled: flag(dish.preorderEnabled, false),
      preorderDate: optionalText(dish.preorderDate, 100),
      preorderTime: optionalText(dish.preorderTime, 100),
      updatedAt: now,
    };

    if (commit) {
      await ex
        .insert(menuItems)
        .values({ id: dishId, ...values })
        .onConflictDoUpdate({ target: menuItems.id, set: values });
    }
    count("menuItems");

    await importDishChildren(dishId, dish, ex, commit, count);
  }
}

async function importDishChildren(
  dishId: string,
  dish: Json,
  ex: Executor,
  commit: boolean,
  count: Counter,
) {
  const sizes = asArray(dish.sizes)
    .map(asRecord)
    .filter((r): r is Json => r !== null)
    .map((s, i) => ({
      id: readClientId(s.id),
      name: optionalText(s.name, 255),
      price: money(s.price),
      sortOrder: i,
    }))
    .filter((s) => s.name !== null);

  const extras = [
    ...readAddonGroup(dish.compulsoryExtras, "REQUIRED"),
    ...readAddonGroup(dish.optionalExtras, "OPTIONAL"),
  ];

  if (!commit) {
    count("menuItemSizes", sizes.length);
    count("menuExtras", extras.length);
    return;
  }

  // Replaced wholesale rather than upserted, so a re-run cannot leave behind an
  // extra the vendor has since removed from the dish.
  await ex.delete(menuExtras).where(eq(menuExtras.menuItemId, dishId));
  await ex.delete(menuItemSizes).where(eq(menuItemSizes.menuItemId, dishId));

  if (sizes.length > 0) {
    await ex.insert(menuItemSizes).values(
      sizes.map((s, i) => ({
        ...(s.id === null ? {} : { id: s.id }),
        menuItemId: dishId,
        name: s.name as string,
        price: s.price,
        sortOrder: i,
      })),
    );
  }

  if (extras.length > 0) {
    await ex.insert(menuExtras).values(
      extras.map((e, i) => ({
        menuItemId: dishId,
        name: e.name,
        price: e.price,
        extraType: e.extraType,
        sortOrder: i,
      })),
    );
  }

  count("menuItemSizes", sizes.length);
  count("menuExtras", extras.length);
}

// ---------------------------------------------------------------------------
// Per-user data
// ---------------------------------------------------------------------------

/**
 * `state.orders` -> `orders` + `order_items` + `order_events`, plus
 * `state.cart` -> `carts` + `cart_items`.
 *
 * The `orders.id` code the customer reads out to the rider is the primary key,
 * so it is preserved verbatim. Line items and status events are replaced per
 * order, which is safe because nothing else points at them.
 */
async function importOrders(
  state: Json,
  userId: number,
  ex: Executor,
  commit: boolean,
  now: Date,
  count: Counter,
  report: ImportReport,
  vendorIdsByStoreId: Map<string, number>,
) {
  const list = asArray(state.orders);
  const knownRiders = new Set((await ex.select({ id: riders.id }).from(riders)).map((r) => r.id));

  for (const raw of list) {
    const order = asRecord(raw);
    if (order === null) continue;

    const id = readClientId(order.id);
    if (id === null) {
      report.skipped.push({ collection: "orders", id: String(order.id), reason: "Unusable order id." });
      continue;
    }

    const storeId = optionalText(order.storeId, 64) ?? "unknown-store";
    const deliveryAddress = optionalText(order.deliveryAddress, 2000);

    if (deliveryAddress === null) {
      report.skipped.push({ collection: "orders", id, reason: "Order has no delivery address." });
      continue;
    }

    // A rider reference is a foreign key. If the rider is not in the imported
    // set it is dropped rather than blocking the order, which is the more
    // useful failure: an order with no rider is still a real order.
    const riderId = readClientId(order.riderId);
    if (riderId !== null && !knownRiders.has(riderId)) {
      report.warnings.push(`Order ${id}: rider "${riderId}" is not a known rider; the reference was dropped.`);
    }

    const status = KNOWN_STATUSES.has(String(order.status)) ? String(order.status) : "PAID";
    if (!KNOWN_STATUSES.has(String(order.status))) {
      report.warnings.push(`Order ${id}: unknown status "${String(order.status)}", imported as PAID.`);
    }

    const review = asRecord(order.review);
    const values = {
      userId,
      vendorId: resolveVendorId(vendorIdsByStoreId, storeId),
      storeId,
      storeName: optionalText(order.storeName, 255) ?? storeId,
      customerName: optionalText(order.customerName, 255) ?? "Customer",
      customerPhone: optionalText(order.customerPhone, 20),
      deliveryAddress,
      deliveryNotes: optionalText(order.deliveryNotes, 1000),
      deliveryLocation: asRecord(order.deliveryLocation),
      paymentMethod: optionalText(order.paymentMethod, 100),
      subtotal: money(order.subtotal),
      serviceFee: money(order.serviceFee),
      deliveryFee: money(order.deliveryFee),
      total: money(order.total),
      status,
      riderId: riderId !== null && knownRiders.has(riderId) ? riderId : null,
      riderName: optionalText(order.riderName, 255),
      pin: optionalText(order.pin, 4),
      routeDistanceMeters: nullableMoney(order.routeDistanceMeters),
      estimatedDurationSeconds: nullableMoney(order.estimatedDurationSeconds),
      rating: review === null ? null : clampRating(review.rating),
      reviewComment: review === null ? null : optionalText(review.comment, 1000),
      reviewedAt: review === null ? null : toDate(review.submittedAt) ?? now,
      createdAt: toDate(order.createdAt) ?? now,
      updatedAt: now,
    };

    if (commit) {
      await ex
        .insert(orders)
        .values({ id, ...values })
        .onConflictDoUpdate({ target: orders.id, set: values });

      await ex.delete(orderItems).where(eq(orderItems.orderId, id));
      await ex.delete(orderEvents).where(eq(orderEvents.orderId, id));
    }
    count("orders");

    const lines = readOrderItems(order);
    if (commit && lines.length > 0) {
      await ex.insert(orderItems).values(lines.map((l) => ({ orderId: id, ...l })));
    }
    count("orderItems", lines.length);

    const events = readOrderEvents(order, status, now);
    if (commit && events.length > 0) {
      await ex.insert(orderEvents).values(events.map((e) => ({ orderId: id, ...e })));
    }
    count("orderEvents", events.length);
  }
}

/**
 * The cart needs a vendor, because `carts.vendor_id` is NOT NULL: a cart is
 * bound to exactly one store, which is the platform's rule. An empty cart, or
 * one pointing at a storefront that was not imported, has nothing to point at.
 */
async function importCart(
  state: Json,
  userId: number,
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
  vendorIdsByStoreId: Map<string, number>,
) {
  const cart = asRecord(state.cart);
  if (cart === null) return;

  const items = readCartItems(cart);
  if (items.length === 0) return;

  const storeId = optionalText(cart.storeId, 64);
  const vendorId = storeId === null ? null : resolveVendorId(vendorIdsByStoreId, storeId);

  if (storeId === null || vendorId === null || vendorId === 0) {
    report.skipped.push({
      collection: "carts",
      id: storeId ?? "unknown",
      reason: "Cart items exist but the cart does not resolve to an imported storefront.",
    });
    return;
  }

  let cartId: number;
  if (commit) {
    const existing = await ex.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
    if (existing[0]) {
      cartId = existing[0].id;
      await ex.update(carts).set({ vendorId, updatedAt: new Date() }).where(eq(carts.id, cartId));
    } else {
      const [inserted] = await ex.insert(carts).values({ userId, vendorId }).returning({ id: carts.id });
      cartId = inserted.id;
    }

    // Replaced wholesale: the cart is a snapshot of what the customer picked,
    // not an append-only log, so the previous contents are stale by definition.
    await ex.delete(cartItems).where(eq(cartItems.cartId, cartId));
    if (items.length > 0) {
      await ex.insert(cartItems).values(items.map((i) => ({ cartId, ...i })));
    }
  } else {
    const existing = await ex.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
    cartId = existing[0]?.id ?? 0;
  }

  count("carts");
  count("cartItems", items.length);
}

/**
 * `state.userProfile.savedAddresses` -> `addresses`.
 *
 * Unlike every other collection this one skips rather than replaces, because
 * an address created later through `/api/addresses` must survive a re-run of an
 * older blob. Addresses have no client-side key, so (user, address text) is
 * the dedupe.
 *
 * `state.selectedLocation` is appended when it is not already saved, since it is
 * the drop-off the customer actually browsed from.
 */
async function importAddresses(
  state: Json,
  userId: number,
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
) {
  const profile = asRecord(state.userProfile);
  const candidates: Json[] = [];

  if (profile !== null) {
    for (const raw of asArray(profile.savedAddresses)) {
      const a = asRecord(raw);
      if (a !== null) candidates.push(a);
    }
  }

  const selected = asRecord(state.selectedLocation);
  if (selected !== null) {
    const text = optionalText(selected.formattedAddress ?? selected.address ?? selected.name, 2000);
    const alreadySaved = candidates.some((a) => (optionalText(a.address, 2000) ?? "") === text);
    if (text !== null && !alreadySaved) {
      candidates.push({
        address: text,
        formattedAddress: text,
        latitude: selected.latitude ?? selected.lat,
        longitude: selected.longitude ?? selected.lng,
        lga: selected.lga,
        state: selected.state,
        deliveryInstructions: selected.deliveryInstructions,
        label: selected.label ?? "Home",
        isDefault: true,
      });
    }
  }

  const existing = new Set(
    (
      await ex
        .select({ address: addresses.address })
        .from(addresses)
        .where(eq(addresses.userId, userId))
    ).map((r) => r.address),
  );

  const rows = [];
  let sawDefault = false;

  for (const a of candidates) {
    const address = optionalText(a.address, 2000);
    const label = `${address ?? ""}::${optionalText(a.label, 60) ?? ""}`;

    if (address === null) {
      report.skipped.push({ collection: "addresses", id: label, reason: "Address is empty." });
      continue;
    }
    if (existing.has(address)) {
      report.warnings.push(`Address already saved, skipped: ${address}`);
      continue;
    }

    // Both coordinates are NOT NULL numeric(9,6); an address without usable
    // coordinates cannot be placed on the map or priced for delivery.
    const latitude = toLat(a.latitude ?? a.lat);
    const longitude = toCoord(a.longitude ?? a.lng);
    if (latitude === null || longitude === null) {
      report.skipped.push({
        collection: "addresses",
        id: label,
        reason: "Address has no usable latitude/longitude.",
      });
      continue;
    }

    const isDefault: boolean = flag(a.isDefault, false) || !sawDefault;
    sawDefault = sawDefault || isDefault;

    rows.push({
      userId,
      label: optionalText(a.label, 60),
      address,
      formattedAddress: optionalText(a.formattedAddress, 2000) ?? address,
      latitude,
      longitude,
      lga: optionalText(a.lga, 100),
      state: optionalText(a.state, 100),
      placeId: optionalText(a.placeId, 255),
      deliveryInstructions: optionalText(a.deliveryInstructions, 1000),
      isDefault,
    });
  }

  if (commit && rows.length > 0) {
    await ex.insert(addresses).values(rows);
  }
  count("addresses", rows.length);
}

/**
 * `state.userProfile.favorites` -> `favorites`.
 *
 * Favourite ids are plain text so a food can point at a `menu_items.id` and a
 * store at a `vendors.storeId`; neither is a foreign key, so an id that no
 * longer exists is kept rather than dropped.
 */
async function importFavorites(
  state: Json,
  userId: number,
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
) {
  const lists = asRecord(asRecord(state.userProfile)?.favorites);
  if (lists === null) return;

  const targets = [
    ...asArray(lists.foods).map((v) => ({ type: "food", id: v })),
    ...asArray(lists.stores).map((v) => ({ type: "store", id: v })),
  ];

  const rows = [];
  const seen = new Set<string>();

  for (const t of targets) {
    const id = readClientId(t.id);
    if (id === null) {
      report.skipped.push({ collection: "favorites", id: String(t.id), reason: "Unusable favourite id." });
      continue;
    }
    const key = `${t.type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ userId, targetType: t.type, targetId: id });
  }

  if (commit && rows.length > 0) {
    // The unique index on (user, type, target) makes a re-run a no-op.
    await ex.insert(favorites).values(rows).onConflictDoNothing();
  }
  count("favorites", rows.length);
}

// ---------------------------------------------------------------------------
// Vendor and admin data
// ---------------------------------------------------------------------------

/**
 * `state.pendingVendors` -> `vendor_applications`, then
 * `state.vendorOnboarding` is folded onto the application it refers to.
 *
 * Applications have no owner in the blob — it was a single shared list — so
 * they import with a null `userId` until a real applicant claims one.
 */
async function importApplications(
  state: Json,
  userId: number,
  ex: Executor,
  commit: boolean,
  now: Date,
  count: Counter,
  report: ImportReport,
  vendorIdsByStoreId: Map<string, number>,
) {
  const claimed = new Set(
    (await ex.select({ applicationId: vendorApplications.applicationId }).from(vendorApplications)).map(
      (r) => r.applicationId,
    ),
  );

  /**
   * Application ids this run is about to create. A dry run writes nothing, so
   * the onboarding step below could not find one of these by querying and would
   * report a false "unknown application" warning that a committed run would not
   * produce.
   */
  const incoming = new Set<string>();

  for (const raw of asArray(state.pendingVendors)) {
    const pv = asRecord(raw);
    if (pv === null) continue;

    const id = readClientId(pv.id);
    if (id === null) {
      report.skipped.push({ collection: "vendorApplications", id: String(pv.id), reason: "Unusable id." });
      continue;
    }

    // Older blobs stored the application under `id` only, so it doubles as the
    // public handle the applicant polls with.
    const applicationId = optionalText(pv.applicationId, 64) ?? id;

    if (claimed.has(applicationId)) {
      const owner = await ex
        .select({ id: vendorApplications.id })
        .from(vendorApplications)
        .where(eq(vendorApplications.applicationId, applicationId))
        .limit(1);
      if (owner[0] && owner[0].id !== id) {
        report.skipped.push({
          collection: "vendorApplications",
          id,
          reason: `applicationId "${applicationId}" already belongs to application ${owner[0].id}.`,
        });
        continue;
      }
    }
    claimed.add(applicationId);
    incoming.add(applicationId);

    const businessName = optionalText(pv.name ?? pv.businessName, 255);
    if (businessName === null) {
      report.skipped.push({ collection: "vendorApplications", id, reason: "Application has no business name." });
      continue;
    }

    const values = {
      applicationId,
      businessName,
      ownerName: optionalText(pv.ownerName, 255),
      ownerEmail: optionalText(pv.ownerEmail, 255),
      ownerPhone: optionalText(pv.ownerPhone ?? pv.phone, 20),
      address: optionalText(pv.address ?? pv.location, 2000),
      lga: optionalText(pv.lga, 100),
      pickupLat: toLat(pv.pickupLat),
      pickupLng: toCoord(pv.pickupLng),
      cuisine: optionalText(pv.cuisine, 100),
      openingTime: optionalText(pv.openingTime, 50),
      closingTime: optionalText(pv.closingTime, 50),
      coverImage: optionalText(pv.coverImg, 2000),
      status: applicationStatus(pv.status),
      updatedAt: now,
    };

    if (commit) {
      await ex
        .insert(vendorApplications)
        .values({ id, createdAt: toDate(pv.appliedAt) ?? now, ...values })
        .onConflictDoUpdate({ target: vendorApplications.id, set: values });
    }
    count("vendorApplications");
  }

  const onboarding = asRecord(state.vendorOnboarding);
  if (onboarding === null) return;

  const applicationId = optionalText(onboarding.applicationId, 64);
  if (applicationId === null) {
    // The seeded default is an approved store with no application behind it, so
    // there is no row to attribute it to. The storefront came across with the
    // catalog.
    return;
  }

  const found = incoming.has(applicationId)
    ? null
    : (
        await ex
          .select({ id: vendorApplications.id })
          .from(vendorApplications)
          .where(eq(vendorApplications.applicationId, applicationId))
          .limit(1)
      )[0];

  if (found === null && !incoming.has(applicationId)) {
    report.warnings.push(`vendorOnboarding refers to unknown application "${applicationId}".`);
    return;
  }

  const storeId = optionalText(onboarding.storeId, 64);
  const patch = {
    status: applicationStatus(onboarding.status),
    rejectionReason: optionalText(onboarding.rejectionReason, 1000),
    vendorId: storeId === null ? null : resolveVendorId(vendorIdsByStoreId, storeId),
    reviewedAt: toDate(onboarding.approvedAt),
    // This one onboarding record does belong to the caller: it is the vendor's
    // own progress, and the blob is being imported on their behalf.
    userId,
    updatedAt: now,
  };

  if (commit) {
    await ex
      .update(vendorApplications)
      .set(patch)
      .where(
        found === null
          ? eq(vendorApplications.applicationId, applicationId)
          : eq(vendorApplications.id, found.id),
      );
  }
  // Counted under its own key: it is a second write to a row `pendingVendors`
  // already accounted for, not another application.
  count("vendorOnboardingLinks");
}

/**
 * `state.vendorWallet` and `state.vendorWithdrawals`, attributed to the
 * storefront the calling admin actually owns.
 *
 * The store is resolved from the session, never from the request body: a wallet
 * is a financial balance, and taking a vendor id from the caller would let any
 * admin overwrite any other vendor's money.
 */
async function importVendorFinance(
  state: Json,
  userId: number,
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
) {
  const wallet = asRecord(state.vendorWallet);
  const withdrawals = asArray(state.vendorWithdrawals);
  if (wallet === null && withdrawals.length === 0) return;

  const own = await ex.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, userId)).limit(1);
  const vendorId = own[0]?.id;

  if (vendorId === undefined) {
    report.skipped.push({
      collection: "vendorWallets",
      id: String(userId),
      reason: "The signed-in user does not own a storefront, so a wallet cannot be attributed.",
    });
    return;
  }

  if (wallet !== null) {
    const values = {
      available: money(wallet.available),
      processing: money(wallet.processing),
      updatedAt: new Date(),
    };
    if (commit) {
      await ex
        .insert(vendorWallets)
        .values({ vendorId, ...values })
        .onConflictDoUpdate({ target: vendorWallets.vendorId, set: values });
    }
    count("vendorWallets");
  }

  for (const raw of withdrawals) {
    const w = asRecord(raw);
    if (w === null) continue;

    const id = readClientId(w.id);
    if (id === null) {
      report.skipped.push({ collection: "vendorWithdrawals", id: String(w.id), reason: "Unusable id." });
      continue;
    }

    const values = {
      vendorId,
      amount: money(w.amount),
      bankName: optionalText(w.bankName, 120),
      accountNumber: optionalText(w.accountNumber, 20),
      status: payoutStatus(w.status),
      paidOutAt: toDate(w.paidOutAt),
      expectedPayDate: toDate(w.expectedPayDate),
      updatedAt: new Date(),
    };

    if (commit) {
      await ex
        .insert(vendorWithdrawals)
        .values({ id, createdAt: toDate(w.requestedAt) ?? new Date(), ...values })
        .onConflictDoUpdate({ target: vendorWithdrawals.id, set: values });
    }
    count("vendorWithdrawals");
  }
}

/** `state.disputes` -> `disputes`. */
async function importDisputes(
  state: Json,
  userId: number,
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
) {
  const knownOrders = new Set((await ex.select({ id: orders.id }).from(orders)).map((o) => o.id));

  for (const raw of asArray(state.disputes)) {
    const d = asRecord(raw);
    if (d === null) continue;

    const id = readClientId(d.id);
    if (id === null) {
      report.skipped.push({ collection: "disputes", id: String(d.id), reason: "Unusable id." });
      continue;
    }

    // `disputes.order_id` is a foreign key with ON DELETE CASCADE, so a
    // complaint about an order that was never imported cannot be stored.
    const orderId = readClientId(d.orderId);
    if (orderId === null || !knownOrders.has(orderId)) {
      report.skipped.push({
        collection: "disputes",
        id,
        reason: `Order "${String(d.orderId)}" is not in the database; the dispute would be dropped.`,
      });
      continue;
    }

    const reason = optionalText(d.reason, 100);
    if (reason === null) {
      report.skipped.push({ collection: "disputes", id, reason: "Dispute has no reason." });
      continue;
    }

    const resolved = d.status === "resolved" || flag(d.resolution, false);
    const values = {
      orderId,
      userId,
      reason,
      details: optionalText(d.details, 2000),
      status: resolved ? "resolved" : "open",
      resolution: optionalText(d.resolution, 2000),
      resolvedAt: resolved ? toDate(d.resolvedAt) ?? new Date() : null,
      updatedAt: new Date(),
    };

    if (commit) {
      await ex
        .insert(disputes)
        .values({ id, createdAt: toDate(d.createdAt) ?? new Date(), ...values })
        .onConflictDoUpdate({ target: disputes.id, set: values });
    }
    count("disputes");
  }
}

/**
 * Recomputes `platform_ledgers` from the order table.
 *
 * The blob's `state.adminLedger` is a counter the browser incremented locally
 * on every status change. Writing it over the database would replace the running
 * total with one browser's partial view of it and double-count anything already
 * recorded by a real checkout, so the ledger is rebuilt from `orders` instead —
 * which is also how the schema says it is maintained. The values the blob
 * claimed are returned in the report so nothing is lost silently.
 *
 * Orders that never became revenue are excluded from GMV: a rejected or
 * cancelled order, and one still awaiting payment.
 */
async function recomputeLedger(
  ex: Executor,
  commit: boolean,
  count: Counter,
  report: ImportReport,
  state: Json,
) {
  const [totals] = await ex
    .select({
      totalGmv: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
      totalServiceFees: sql<number>`coalesce(sum(${orders.serviceFee}), 0)::int`,
      completedDeliveries: sql<number>`count(*) filter (where ${orders.status} = 'DELIVERED')::int`,
    })
    .from(orders)
    .where(sql`${orders.status} not in ('REJECTED', 'CANCELLED', 'PENDING_PAYMENT')`);

  const claimed = asRecord(state.adminLedger);
  if (claimed !== null) {
    report.warnings.push(
      `state.adminLedger claimed gmv=${String(claimed.totalGmv)}, serviceFees=${String(
        claimed.totalServiceFees,
      )}, delivered=${String(claimed.completedDeliveries)}. It was not written; the ledger is recomputed from the order table, which currently reads gmv=${totals.totalGmv}, serviceFees=${totals.totalServiceFees}, delivered=${totals.completedDeliveries}.`,
    );
  }

  if (commit) {
    await ex
      .insert(platformLedgers)
      .values({ id: 1, ...totals, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformLedgers.id,
        set: { ...totals, updatedAt: new Date() },
      });
  }
  count("platformLedgers");
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/**
 * Order lines. The blob calls the dish reference `dishId` and the unit price
 * `unitPrice`; older carts called the price `price`, so both are accepted.
 *
 * `menu_item_id` is a plain varchar with no foreign key on purpose (a vendor can
 * delete a dish that is already on an order), so an unresolvable reference is
 * kept as-is and only a malformed one is dropped.
 */
function readOrderItems(order: Json) {
  return asArray(order.items)
    .map(asRecord)
    .filter((i): i is Json => i !== null)
    .map((i) => {
      const qty = Math.max(1, money(i.qty, 1));
      const unitPrice = money(i.unitPrice ?? i.price);
      return {
        menuItemId: readClientId(i.dishId ?? i.menuItemId),
        name: optionalText(i.name, 255) ?? "Item",
        qty,
        unitPrice,
        itemTotal: money(i.itemTotal ?? i.total, unitPrice * qty),
        selectedAddons: readAddons(i.selectedAddons),
      };
    });
}

function readCartItems(cart: Json) {
  return asArray(cart.items)
    .map(asRecord)
    .filter((i): i is Json => i !== null)
    .map((i) => {
      const qty = Math.max(1, money(i.qty, 1));
      const unitPrice = money(i.price ?? i.unitPrice);
      return {
        menuItemId: readClientId(i.dishId ?? i.menuItemId),
        name: optionalText(i.name, 255) ?? "Item",
        img: optionalText(i.img, 2000),
        unitPrice,
        qty,
        itemTotal: money(i.itemTotal ?? i.total, unitPrice * qty),
        selectedAddons: readAddons(i.selectedAddons),
      };
    });
}

/**
 * The status trail from `state.orders[].history`, synthesising one entry when a
 * blob has none so the order timeline is never blank for a known order.
 */
function readOrderEvents(order: Json, status: string, now: Date) {
  const history = asArray(order.history)
    .map(asRecord)
    .filter((h): h is Json => h !== null);

  const events = history
    .map((h) => {
      const s = String(h.status ?? "");
      const known = KNOWN_STATUSES.has(s);
      return {
        status: known ? s : status,
        note: optionalText(h.note, 500) ?? (known ? s : status),
        actor: "system" as const,
        createdAt: toDate(h.timestamp) ?? now,
      };
    })
    .filter((e) => KNOWN_STATUSES.has(e.status));

  if (events.length > 0) return events;
  return [{ status, note: null, actor: "system" as const, createdAt: toDate(order.createdAt) ?? now }];
}

/**
 * `extra_type` is uppercased because that is the form the rest of the app uses:
 * `seed.ts` and the vendor menu route both write `REQUIRED`/`OPTIONAL`, and
 * `serializeMenuItem` splits the two lists by testing for those exact strings.
 * Importing the lowercase form would silently demote every compulsory extra to
 * an optional one.
 */
function readAddonGroup(value: unknown, extraType: "REQUIRED" | "OPTIONAL") {
  return asArray(value)
    .map(asRecord)
    .filter((e): e is Json => e !== null)
    .map((e) => ({
      name: optionalText(e.name, 255),
      price: money(e.price),
      extraType,
    }))
    .filter((e): e is { name: string; price: number; extraType: "REQUIRED" | "OPTIONAL" } => e.name !== null);
}

/** `{ name, price }[]`, dropping anything malformed so the jsonb column stays typed. */
function readAddons(value: unknown): { name: string; price: number }[] {
  return asArray(value)
    .map(asRecord)
    .filter((e): e is Json => e !== null)
    .map((e) => ({ name: optionalText(e.name, 255), price: money(e.price) }))
    .filter((e): e is { name: string; price: number } => e.name !== null);
}

// ---------------------------------------------------------------------------
// Coercions
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Json | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Json;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStrings(value: unknown): string[] {
  return asArray(value)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

/** `[lng, lat]`, or null if it is not a pair of finite numbers. */
function asPair(value: unknown): [number, number] | null {
  const pair = asArray(value);
  if (pair.length !== 2) return null;
  const a = Number(pair[0]);
  const b = Number(pair[1]);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

function asPairs(value: unknown): [number, number][] | null {
  const raw = asArray(value);
  const out: [number, number][] = [];
  for (const entry of raw) {
    const pair = asPair(entry);
    if (pair === null) return null;
    out.push(pair);
  }
  return out;
}

/** Money in naira: a whole number, never negative, zero allowed. */
function money(value: unknown, fallback = 0): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Like `money` but keeps NULL for an absent value, for nullable columns. */
function nullableMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : null;
}

/** A `real` rating. Clamped rather than rounded, so 4.9 survives. */
function rating(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(0, n));
}

/** Ratings are stored as integers. */
function clampRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, n));
}

function rate(value: unknown, fallback = 0.15): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * The blob's dish status is a mix of the `inStock` boolean the client toggles
 * and the `status` string the database uses, so both are consulted.
 *
 * Uppercase, because that is what the rest of the app writes and reads:
 * `seed.ts` emits `AVAILABLE`/`OUT_OF_STOCK`, the vendor screen sends
 * `AVAILABLE`, and `serializeMenuItem` tests for `AVAILABLE` to decide
 * `inStock`. The lowercase form the column's SQL default happens to use would
 * import every dish as out of stock.
 */
function dishStatus(dish: Json): string {
  if (dish.inStock === false) return "OUT_OF_STOCK";
  const raw = optionalText(dish.status, 30)?.toUpperCase();
  if (raw === "AVAILABLE" || raw === "OUT_OF_STOCK" || raw === "PREORDER" || raw === "HIDDEN") return raw;
  return "AVAILABLE";
}

/** `SCOOP | PLATE | BOTH | PIECE`, uppercased for the same reason as `dishStatus`. */
function priceTypeOf(dish: Json): string {
  const raw = optionalText(dish.priceType, 20)?.toUpperCase();
  if (raw === "SCOOP" || raw === "PLATE" || raw === "BOTH" || raw === "PIECE") return raw;
  // The blob predates the column; a dish with piece pricing is the only case
  // where guessing wrong changes the price charged.
  return nullableMoney(dish.piecePrice) !== null && nullableMoney(dish.platePrice) === null
    ? "PIECE"
    : "BOTH";
}

function applicationStatus(value: unknown): string {
  const raw = String(value ?? "").toLowerCase();
  return raw === "approved" || raw === "rejected" ? raw : "pending";
}

function payoutStatus(value: unknown): string {
  const raw = String(value ?? "").toLowerCase();
  return raw === "paid" || raw === "rejected" ? raw : "processing";
}

/** An ISO timestamp, or null when it is missing or unparseable. */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Picks a slug that no other storefront holds.
 *
 * `vendors.slug` is unique on its own and the client only set it on some
 * storefronts, so a name collision would otherwise abort the import.
 */
function claimSlug(taken: Map<string, string>, storeId: string, preferred: string): string {
  const base =
    preferred
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 255) || "store";

  if (!taken.has(base) || taken.get(base) === storeId) {
    taken.set(base, storeId);
    return base;
  }

  for (let n = 2; n < 200; n += 1) {
    const candidate = `${base}-${n}`.slice(0, 255);
    if (!taken.has(candidate) || taken.get(candidate) === storeId) {
      taken.set(candidate, storeId);
      return candidate;
    }
  }

  const fallback = `${base}-${Date.now()}`.slice(0, 255);
  taken.set(fallback, storeId);
  return fallback;
}

function resolveVendorId(vendorIdsByStoreId: Map<string, number>, storeId: string): number | null {
  return vendorIdsByStoreId.get(storeId) ?? null;
}

export function isImportScope(value: unknown): value is ImportScope {
  return typeof value === "string" && (SCOPES as string[]).includes(value);
}
