import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  categories,
  deliveryConfigs,
  deliveryLocations,
  menuExtras,
  menuItemSizes,
  menuItems,
  platformLedgers,
  riders,
  serviceZones,
  stateBoundaries,
  vendorWallets,
  vendors,
} from "./index";
import { loadMarketplaceSeed, type SeedMenuItem, type SeedRestaurant } from "./seed-data";

/**
 * Loads the bundled marketplace dataset into Postgres.
 *
 * This is the migration of the last localStorage-only data. Before this, the
 * restaurants, their menus, the riders, the service zones, the delivery fee
 * rules and the saved locations all lived in `public/app/js/data.js` and
 * `service-zones.js` as browser constants, so the admin panel could edit them
 * only for the browser doing the editing. After this they are rows.
 *
 * Every write is an upsert keyed on the same public id the client already uses,
 * so running the script repeatedly is safe and re-running it after editing a
 * seed file updates the database rather than duplicating it.
 *
 * The menu-item loop uses bulk inserts (all items for a vendor in one query,
 * all their sizes in one query, all their extras in one query) to avoid
 * connection timeouts on hosted Postgres pools (e.g. Supabase).
 */

/** numeric(9,6) columns are handed to pg as strings to avoid float drift. */
function coord(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(value).toFixed(6);
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "store";
}

function money(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Categories sold by piece, where a size or per-item price replaces the plate
 * price rather than adding to it. Mirrors `PIECE_CATEGORIES` in
 * `src/app/api/vendor/menu-items/route.ts` and `ChowUnits` on the client.
 */
const PIECE_CATEGORIES = ["drinks", "snacks", "grills", "shawarma", "others"];

/**
 * Works out the pricing a dish should be stored with.
 *
 * The bundled data is not uniform: the newer Iya Moria dishes declare
 * `priceType` plus `scoopPrice`/`platePrice`, while the older ones only carry a
 * flat `price`. Storing the older ones verbatim would leave every price column
 * null and the dish would render as free, so the flat price is folded into the
 * column that `priceType` actually selects.
 */
function resolvePricing(dish: SeedMenuItem) {
  const isPiece = PIECE_CATEGORIES.includes(dish.category);
  const declared = (dish.priceType || "").toUpperCase();

  // A dish in a piece category cannot be scoop or plate priced, and a plated
  // dish cannot be per-piece, so the category wins over whatever was declared.
  const priceType = isPiece
    ? "PIECE"
    : declared === "SCOOP" || declared === "BOTH"
      ? declared
      : "PLATE";

  const scoop = money(dish.scoopPrice);
  const plate = money(dish.platePrice);
  const piece = money(dish.piecePrice);
  const flat = money(dish.price);

  const scoopPrice = priceType === "PIECE" ? null : scoop || null;
  const platePrice = priceType === "PIECE" ? null : plate || (priceType === "PLATE" ? flat || null : null);
  const piecePrice = priceType === "PIECE" ? piece || flat || null : null;

  // The price shown to the customer: the flat price when the dish has one,
  // otherwise the cheapest way to buy it.
  const price =
    flat ||
    (priceType === "PIECE" ? money(piecePrice) : money(platePrice) || money(scoopPrice));

  return { priceType, price, scoopPrice, platePrice, piecePrice };
}

/**
 * Flattens a dish's extras into the required/optional split the `menu_extras`
 * table stores.
 *
 * `compulsoryExtras`/`optionalExtras` is the current shape, but the older
 * bundled dishes use `addonGroups` instead. Both are read, and the explicit
 * split wins when a dish somehow carries both.
 */
function resolveExtras(dish: SeedMenuItem) {
  const pick = (list: { name: string; price: number }[] | undefined) =>
    (list ?? [])
      .filter((e) => e && String(e.name || "").trim())
      .map((e) => ({ name: String(e.name).trim(), price: money(e.price) }));

  const required = pick(dish.compulsoryExtras);
  const optional = pick(dish.optionalExtras);

  if (required.length > 0 || optional.length > 0) {
    return [
      ...required.map((e) => ({ ...e, extraType: "REQUIRED" as const })),
      ...optional.map((e) => ({ ...e, extraType: "OPTIONAL" as const })),
    ];
  }

  const groups = dish.addonGroups ?? [];
  return groups.flatMap((group) =>
    pick(group.options).map((e) => ({
      ...e,
      extraType: group.required ? ("REQUIRED" as const) : ("OPTIONAL" as const),
    })),
  );
}

async function seedCategories() {
  const { categories: seed } = loadMarketplaceSeed();

  // "all" is a client-side pseudo-filter over the union of the others, not a
  // real category, so it is not stored.
  const rows = seed
    .filter((c) => c.id !== "all")
    .map((c) => ({
      name: c.name,
      slug: c.id,
      icon: c.icon,
      image: c.img,
      isActive: true,
    }));

  await db
    .insert(categories)
    .values(rows)
    .onConflictDoUpdate({
      target: categories.slug,
      set: { name: sql`excluded.name`, icon: sql`excluded.icon`, image: sql`excluded.image` },
    });

  console.log(`  categories        ${rows.length}`);
}

async function seedDeliveryGeography() {
  const { locations, zones, ogunBoundary, deliveryConfig } = loadMarketplaceSeed();

  await db
    .insert(deliveryLocations)
    .values(
      locations.map((loc, i) => ({
        id: loc.id,
        name: loc.name,
        latitude: coord(loc.lat)!,
        longitude: coord(loc.lng)!,
        city: loc.city,
        type: loc.type,
        sortOrder: i,
      })),
    )
    .onConflictDoUpdate({
      target: deliveryLocations.id,
      set: {
        name: sql`excluded.name`,
        latitude: sql`excluded.latitude`,
        longitude: sql`excluded.longitude`,
        city: sql`excluded.city`,
        type: sql`excluded.type`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(serviceZones)
    .values(
      zones.map((zone, i) => ({
        id: zone.id,
        name: zone.name,
        isActive: zone.active,
        state: zone.state,
        lga: zone.lga,
        center: zone.center,
        maxDeliveryDistance: zone.maxDeliveryDistance,
        deliveryRules: zone.deliveryRules,
        operatingHours: zone.operatingHours,
        polygon: zone.polygon,
        sortOrder: i,
      })),
    )
    .onConflictDoUpdate({
      target: serviceZones.id,
      set: {
        name: sql`excluded.name`,
        isActive: sql`excluded.is_active`,
        state: sql`excluded.state`,
        lga: sql`excluded.lga`,
        center: sql`excluded.center`,
        maxDeliveryDistance: sql`excluded.max_delivery_distance`,
        deliveryRules: sql`excluded.delivery_rules`,
        operatingHours: sql`excluded.operating_hours`,
        polygon: sql`excluded.polygon`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(stateBoundaries)
    .values({ id: "ogun", name: "Ogun State", polygon: ogunBoundary })
    .onConflictDoUpdate({
      target: stateBoundaries.id,
      set: { polygon: sql`excluded.polygon`, updatedAt: new Date() },
    });

  await db
    .insert(deliveryConfigs)
    .values({
      id: 1,
      baseFee: money(deliveryConfig.baseFee) || 300,
      serviceFee: money(deliveryConfig.serviceFee) || 400,
      ratePerMeter: Number(deliveryConfig.ratePerMeter) || 0.15,
      minDeliveryFee: money(deliveryConfig.minDeliveryFee) || 300,
    })
    .onConflictDoNothing();

  console.log(`  delivery locations ${locations.length}`);
  console.log(`  service zones      ${zones.length}`);
}

async function seedRestaurants() {
  const { restaurants } = loadMarketplaceSeed();

  let itemCount = 0;
  let extraCount = 0;
  let sizeCount = 0;

  for (const store of restaurants as SeedRestaurant[]) {
    // Upsert the vendor row and get its internal UUID back.
    const [vendor] = await db
      .insert(vendors)
      .values({
        // userId stays null: a seeded storefront has no owner, which is what
        // lets an admin-created application claim it later.
        userId: null,
        storeId: store.id,
        businessName: store.name,
        slug: store.slug || slugify(store.name),
        description: null,
        cuisine: store.tags?.[0] ?? null,
        status: "approved",
        source: "seed",
        image: store.bannerImg ?? null,
        bannerImage: store.bannerImg ?? null,
        rating: Number(store.rating) || 5,
        reviewsCount: Number(store.reviewsCount) || 0,
        prepTime: store.prepTime ?? null,
        deliveryFee: money(store.deliveryFee),
        openingTime: store.openingTime ?? null,
        closingTime: store.closingTime ?? null,
        operatingHours: { open: store.openingTime ?? "08:00", close: store.closingTime ?? "22:00" },
        latitude: coord(store.lat),
        longitude: coord(store.lng),
        address: store.address,
        isOpen: store.open !== false,
        isVerified: store.isVerified !== false,
        isBudget: Boolean(store.isBudget),
        isRecommended: Boolean(store.isRecommended),
        isPopular: Boolean(store.isPopular),
        isFast: Boolean(store.isFast),
        category: store.category,
        tags: store.tags ?? [],
      })
      .onConflictDoUpdate({
        target: vendors.storeId,
        set: {
          businessName: sql`excluded.business_name`,
          slug: sql`excluded.slug`,
          bannerImage: sql`excluded.banner_image`,
          rating: sql`excluded.rating`,
          prepTime: sql`excluded.prep_time`,
          deliveryFee: sql`excluded.delivery_fee`,
          address: sql`excluded.address`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
          isOpen: sql`excluded.is_open`,
          category: sql`excluded.category`,
          tags: sql`excluded.tags`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: vendors.id });

    const vendorId = vendor.id;
    const menu = (store.menu ?? []) as SeedMenuItem[];

    if (menu.length === 0) continue;

    // ── 1. Bulk-upsert all menu items for this vendor in one query ─────────
    const itemRows = menu.map((dish) => {
      const pricing = resolvePricing(dish);
      return {
        id: dish.id,
        vendorId,
        name: dish.name,
        description: dish.desc ?? null,
        imageUrl: dish.img ?? null,
        category: dish.category,
        priceType: pricing.priceType,
        price: pricing.price,
        scoopPrice: pricing.scoopPrice,
        platePrice: pricing.platePrice,
        piecePrice: pricing.piecePrice,
        status: (dish.inStock === false ? "OUT_OF_STOCK" : "AVAILABLE") as "AVAILABLE" | "OUT_OF_STOCK",
        isPublished: true,
        preorderEnabled: Boolean(dish.preorderEnabled),
        preorderDate: dish.preorderDate || null,
        preorderTime: dish.preorderTime || null,
      };
    });

    await db
      .insert(menuItems)
      .values(itemRows)
      .onConflictDoUpdate({
        target: menuItems.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          imageUrl: sql`excluded.image_url`,
          category: sql`excluded.category`,
          priceType: sql`excluded.price_type`,
          price: sql`excluded.price`,
          scoopPrice: sql`excluded.scoop_price`,
          platePrice: sql`excluded.plate_price`,
          piecePrice: sql`excluded.piece_price`,
          status: sql`excluded.status`,
          updatedAt: new Date(),
        },
      });

    itemCount += menu.length;

    const allItemIds = menu.map((d) => d.id);

    // ── 2. Bulk-replace sizes: one DELETE for all items, one INSERT ────────
    // Sizes and extras are fully owned by the seed item, so they are replaced
    // rather than merged — a dish removed from the seed loses its rows here.
    await db.delete(menuItemSizes).where(inArray(menuItemSizes.menuItemId, allItemIds));

    const sizeRows = menu.flatMap((dish) =>
      (dish.sizes ?? []).map((size, i) => ({
        id: size.id ?? `sz-${dish.id}-${i}`,
        menuItemId: dish.id,
        name: size.name,
        price: money(size.price),
        isAvailable: true,
        sortOrder: i,
      })),
    );

    if (sizeRows.length > 0) {
      await db.insert(menuItemSizes).values(sizeRows);
      sizeCount += sizeRows.length;
    }

    // ── 3. Bulk-replace extras: one DELETE for all items, one INSERT ───────
    await db.delete(menuExtras).where(inArray(menuExtras.menuItemId, allItemIds));

    const extraRows = menu.flatMap((dish) =>
      resolveExtras(dish).map((extra, i) => ({
        menuItemId: dish.id,
        name: extra.name,
        price: extra.price,
        extraType: extra.extraType,
        isAvailable: true,
        sortOrder: i,
      })),
    );

    if (extraRows.length > 0) {
      await db.insert(menuExtras).values(extraRows);
      extraCount += extraRows.length;
    }
  }

  console.log(`  stores             ${restaurants.length}`);
  console.log(`  menu items         ${itemCount}`);
  console.log(`  menu extras        ${extraCount}`);
  console.log(`  menu sizes         ${sizeCount}`);
}

async function seedRiders() {
  const { riders: seed } = loadMarketplaceSeed();

  await db
    .insert(riders)
    .values(
      seed.map((r) => ({
        id: r.id,
        userId: null,
        name: r.name,
        phone: r.phone,
        vehicle: r.vehicle,
        avatar: r.avatar,
        rating: Number(r.rating) || 5,
        tripsCount: Number(r.tripsCount) || 0,
        isOnline: Boolean(r.online),
        isAvailable: Boolean(r.online),
        currentLat: coord(r.currentLat),
        currentLng: coord(r.currentLng),
      })),
    )
    .onConflictDoUpdate({
      target: riders.id,
      set: {
        name: sql`excluded.name`,
        phone: sql`excluded.phone`,
        vehicle: sql`excluded.vehicle`,
        avatar: sql`excluded.avatar`,
        rating: sql`excluded.rating`,
        tripsCount: sql`excluded.trips_count`,
        isOnline: sql`excluded.is_online`,
        isAvailable: sql`excluded.is_available`,
        currentLat: sql`excluded.current_lat`,
        currentLng: sql`excluded.current_lng`,
        updatedAt: new Date(),
      },
    });

  console.log(`  riders             ${seed.length}`);
}

/**
 * Makes sure every vendor has a wallet row. Approved applications and the
 * withdrawal flow both read the wallet directly, and a missing row would read
 * as a zero balance rather than as an error, so a vendor could not tell that
 * they had never been paid out.
 */
async function ensureWallets() {
  const all = await db.select({ id: vendors.id }).from(vendors);
  if (all.length === 0) return;

  const existing = await db.select({ vendorId: vendorWallets.vendorId }).from(vendorWallets);
  const known = new Set(existing.map((r) => r.vendorId));
  const missing = all.map((v) => v.id).filter((id) => !known.has(id));

  if (missing.length > 0) {
    await db.insert(vendorWallets).values(missing.map((vendorId) => ({ vendorId })));
  }

  console.log(`  wallets ensured    ${missing.length}`);
}

async function seed() {
  console.log("Seeding Chow45 marketplace data into Postgres...\n");

  await seedCategories();
  await seedDeliveryGeography();
  await seedRestaurants();
  await seedRiders();
  await ensureWallets();

  await db.insert(platformLedgers).values({ id: 1 }).onConflictDoNothing();

  console.log("\nDone seeding.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
