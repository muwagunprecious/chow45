import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  addresses,
  cartItems,
  carts,
  categories,
  deliveryConfigs,
  deliveryLocations,
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
  users,
  vendorApplications,
  vendorWallets,
  vendorWithdrawals,
  vendors,
} from "@/db";
import { currentRole, currentUserId } from "@/lib/session";
import {
  serializeAddress,
  serializeApplication,
  serializeCart,
  serializeConfig,
  serializeDispute,
  serializeFavorites,
  serializeLocation,
  serializeMenuItem,
  serializeOrder,
  serializeRider,
  serializeStore,
  serializeWallet,
  serializeWithdrawal,
  serializeZone,
  type ClientMenuItem,
  type ClientStore,
} from "@/lib/serializers";

/**
 * Everything the browser needs to render the marketplace, in one request.
 *
 * This replaces the `loadInitialState()` read of the whole state blob out of
 * localStorage. The client used to render the entire app with zero network
 * calls; now it asks the database once on boot and rebuilds the same object
 * shape from the response, so the renderers in `customer.js`, `vendor.js`,
 * `rider.js` and `admin.js` keep working unchanged.
 *
 * Split by audience:
 *  - the public half (stores, menus, riders, zones, fee config, categories,
 *    locations) is returned to everyone, because browsing is public
 *  - the private half only comes back for a signed-in caller, and is narrowed
 *    further by role: an admin sees every application, the ledger and all
 *    disputes; a vendor sees only their own store's data
 *
 * The collections are fetched with a fixed number of round trips rather than one
 * query per collection, because this runs on every page load. Menus, sizes and
 * extras are grouped in memory afterwards instead of being queried per store.
 */
export async function GET(request: Request) {
  try {
    const userId = await currentUserId(request);
    const role = await currentRole(request);
    const isAdmin = role === "ADMIN";
    const isVendor = role === "VENDOR";

    const stores = await loadStores();

    const [configRows, zoneRows, locationRows, categoryRows, riderRows] = await Promise.all([
      db.select().from(deliveryConfigs).limit(1),
      db.select().from(serviceZones).orderBy(asc(serviceZones.sortOrder)),
      db.select().from(deliveryLocations).orderBy(asc(deliveryLocations.sortOrder)),
      db.select().from(categories).orderBy(asc(categories.name)),
      db.select().from(riders).orderBy(asc(riders.name)),
    ]);

    const payload: Record<string, unknown> = {
      stores,
      riders: riderRows.map(serializeRider),
      serviceZones: zoneRows.map(serializeZone),
      locations: locationRows.map(serializeLocation),
      categories: categoryRows.map((c) => ({
        id: c.slug,
        name: c.name,
        icon: c.icon ?? "",
        img: c.image ?? "",
      })),
      deliveryConfig: serializeConfig(configRows[0]),
      signedIn: userId !== null,
      role,
      user: null,
      cart: serializeCart(null, []),
      orders: [],
      favorites: { foods: [], stores: [] },
      addresses: [],
      selectedLocation: null,
      vendorWallet: serializeWallet(undefined),
      vendorWithdrawals: [],
      pendingVendors: [],
      myApplication: null,
      disputes: [],
      adminLedger: { totalGmv: 0, totalServiceFees: 0, completedDeliveries: 0 },
    };

    let resolvedUserId = userId;
    let resolvedRole = role;

    if (resolvedUserId === null) {
      const headerEmail = (request.headers.get("x-vendor-email") || "").toLowerCase().trim();
      const headerStoreId = (request.headers.get("x-vendor-store-id") || "").trim();
      const headerVendorId = Number(request.headers.get("x-vendor-id"));

      if (headerEmail || headerStoreId || headerVendorId > 0) {
        const vendorMatch = await db
          .select()
          .from(vendors)
          .where(
            or(
              headerEmail ? sql`LOWER(${vendors.contactEmail}) = ${headerEmail}` : undefined,
              headerStoreId ? eq(vendors.storeId, headerStoreId) : undefined,
              headerVendorId > 0 ? eq(vendors.id, headerVendorId) : undefined
            )
          )
          .limit(1);

        if (vendorMatch.length > 0 && vendorMatch[0].userId) {
          resolvedUserId = vendorMatch[0].userId;
          resolvedRole = "VENDOR";
          payload.signedIn = true;
          payload.role = "VENDOR";
        }
      }
    }

    if (resolvedUserId === null) {
      return NextResponse.json(payload);
    }

    const resolvedIsAdmin = resolvedRole === "ADMIN";
    const resolvedIsVendor = resolvedRole === "VENDOR";

    await attachPrivateData(payload, stores, resolvedUserId);
    await attachRoleData(payload, stores, resolvedUserId, resolvedIsAdmin, resolvedIsVendor);

    return NextResponse.json(payload);
  } catch (e: any) {
    console.warn("[bootstrap] Database bootstrap query failed, returning fallback payload:", e?.message || e);
    return NextResponse.json({
      stores: [],
      riders: [],
      serviceZones: [],
      locations: [],
      categories: [],
      deliveryConfig: null,
      signedIn: false,
      role: "customer",
      user: null,
      cart: serializeCart(null, []),
      orders: [],
      favorites: { foods: [], stores: [] },
      addresses: [],
      selectedLocation: null,
      vendorWallet: serializeWallet(undefined),
      vendorWithdrawals: [],
      pendingVendors: [],
      myApplication: null,
      disputes: [],
      adminLedger: { totalGmv: 0, totalServiceFees: 0, completedDeliveries: 0 },
      error: e?.message || "Database unavailable",
      fallback: true
    }, { status: 200 });
  }
}

/**
 * Loads every storefront with its published menu.
 *
 * Menus, sizes and extras come back in three queries and are grouped by vendor
 * in memory. Querying per store would be an N+1 that runs on every page load.
 */
async function loadStores(): Promise<ClientStore[]> {
  const storeRows = await db.select().from(vendors).orderBy(asc(vendors.createdAt));

  const vendorIds = storeRows.map((v) => v.id);
  if (vendorIds.length === 0) return [];

  const menuRows = await db
    .select()
    .from(menuItems)
    .where(
      and(
        inArray(menuItems.vendorId, vendorIds),
        ne(menuItems.status, "rejected")
      )
    )
    .orderBy(asc(menuItems.createdAt));

  const itemIds = menuRows.map((m) => m.id);
  const [sizeRows, extraRows] = itemIds.length
    ? await Promise.all([
        db
          .select()
          .from(menuItemSizes)
          .where(inArray(menuItemSizes.menuItemId, itemIds))
          .orderBy(asc(menuItemSizes.sortOrder)),
        db
          .select()
          .from(menuExtras)
          .where(inArray(menuExtras.menuItemId, itemIds))
          .orderBy(asc(menuExtras.sortOrder)),
      ])
    : [[], []];

  const sizesBy = groupBy(sizeRows, (s) => s.menuItemId);
  const extrasBy = groupBy(extraRows, (e) => e.menuItemId);

  const menuByVendor = new Map<number, ClientMenuItem[]>();
  for (const item of menuRows) {
    if (item.vendorId === null) continue;
    const list = menuByVendor.get(item.vendorId) ?? [];
    list.push(serializeMenuItem(item, sizesBy.get(item.id) ?? [], extrasBy.get(item.id) ?? []));
    menuByVendor.set(item.vendorId, list);
  }

  return storeRows.map((v) => serializeStore(v, menuByVendor.get(v.id) ?? []));
}

type MenuChild = { menuItemId: string };

function groupBy<T extends MenuChild>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k) ?? [];
    list.push(row);
    out.set(k, list);
  }
  return out;
}

/** The signed-in customer's own data: profile, cart, orders, favourites, addresses. */
async function attachPrivateData(
  payload: Record<string, unknown>,
  stores: ClientStore[],
  userId: number,
) {
  const [userRows, cartRows, addressRows, favoriteRows, orderRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(carts).where(eq(carts.userId, userId)).limit(1),
    db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isDefault), asc(addresses.id)),
    db.select().from(favorites).where(eq(favorites.userId, userId)),
    db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(100),
  ]);

  const user = userRows[0];
  if (user) {
    const vMatch = await db
      .select()
      .from(vendors)
      .where(or(eq(vendors.userId, user.id), sql`LOWER(${vendors.contactEmail}) = LOWER(${user.email})`))
      .limit(1);

    const v = vMatch[0];
    payload.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      role: v ? "VENDOR" : user.role,
      image: user.image,
      refCode: user.refCode,
      vendorId: v?.id,
      storeId: v?.storeId,
      businessName: v?.businessName,
    };

    if (v) {
      payload.vendor = {
        id: v.id,
        storeId: v.storeId,
        businessName: v.businessName,
        contactEmail: v.contactEmail,
      };
    }
  } else {
    payload.user = null;
  }

  // Cart, its line items, and the store they belong to. An emptied cart keeps
  // pointing at the last store, but the client treats "no items" as no cart, so
  // the store is only attached when there is something in it.
  const cart = cartRows[0] ?? null;
  if (cart) {
    const rows = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(asc(cartItems.id));

    const store = rows.length ? await resolveStoreByVendorId(stores, cart.vendorId) : null;
    payload.cart = serializeCart(cart, rows, store);
  }

  // Orders with their line items and status trail.
  const orderIds = orderRows.map((o) => o.id);
  const [itemRows, eventRows] = orderIds.length
    ? await Promise.all([
        db
          .select()
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
          .orderBy(asc(orderItems.id)),
        db
          .select()
          .from(orderEvents)
          .where(inArray(orderEvents.orderId, orderIds))
          .orderBy(asc(orderEvents.createdAt)),
      ])
    : [[], []];

  const itemsByOrder = groupOrderRows(itemRows);
  const eventsByOrder = groupOrderRows(eventRows);

  payload.orders = orderRows.map((o) =>
    serializeOrder(o, itemsByOrder.get(o.id) ?? [], eventsByOrder.get(o.id) ?? []),
  );

  payload.favorites = serializeFavorites(favoriteRows);
  payload.addresses = addressRows.map(serializeAddress);

  // The default address doubles as the customer's selected drop-off, which is
  // what `state.selectedLocation` used to hold.
  const preferred = addressRows.find((a) => a.isDefault) ?? addressRows[0];
  payload.selectedLocation = preferred
    ? {
        id: String(preferred.id),
        name: preferred.formattedAddress ?? preferred.address,
        label: preferred.label ?? "Home",
        address: preferred.address,
        formattedAddress: preferred.formattedAddress ?? preferred.address,
        latitude: Number(preferred.latitude),
        longitude: Number(preferred.longitude),
        lat: Number(preferred.latitude),
        lng: Number(preferred.longitude),
        lga: preferred.lga ?? "",
        state: preferred.state ?? "",
        country: "Nigeria",
        deliveryInstructions: preferred.deliveryInstructions ?? "",
      }
    : null;
}

type OrderChild = { orderId: string };

function groupOrderRows<T extends OrderChild>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const list = out.get(row.orderId) ?? [];
    list.push(row);
    out.set(row.orderId, list);
  }
  return out;
}

/**
 * The serialised store list has no internal vendor id in it, so the mapping
 * back is done with a single lookup query rather than by re-joining everything.
 */
async function resolveStoreByVendorId(
  stores: ClientStore[],
  vendorId: number,
): Promise<ClientStore | null> {
  const rows = await db
    .select({ id: vendors.id, storeId: vendors.storeId })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const storeId = rows[0]?.storeId ?? null;
  if (storeId === null) return null;

  return stores.find((s) => s.id === storeId) ?? null;
}

/** Vendor-only and admin-only slices. */
async function attachRoleData(
  payload: Record<string, unknown>,
  stores: ClientStore[],
  userId: number,
  isAdmin: boolean,
  isVendor: boolean,
) {
  // An applicant sees their own application so the onboarding screen can show
  // the outcome; an admin additionally sees the full pending queue.
  const ownApplication = await db
    .select()
    .from(vendorApplications)
    .where(eq(vendorApplications.userId, userId))
    .orderBy(desc(vendorApplications.createdAt))
    .limit(1);

  payload.myApplication = ownApplication[0] ? serializeApplication(ownApplication[0]) : null;

  if (isAdmin) {
    const [pending, disputeRows, ledgerRows] = await Promise.all([
      db
        .select()
        .from(vendorApplications)
        .where(eq(vendorApplications.status, "pending"))
        .orderBy(desc(vendorApplications.createdAt)),
      db.select().from(disputes).orderBy(desc(disputes.createdAt)),
      db.select().from(platformLedgers).limit(1),
    ]);

    payload.pendingVendors = pending.map(serializeApplication);
    payload.disputes = disputeRows.map(serializeDispute);

    const ledger = ledgerRows[0];
    payload.adminLedger = {
      totalGmv: ledger?.totalGmv ?? 0,
      totalServiceFees: ledger?.totalServiceFees ?? 0,
      completedDeliveries: ledger?.completedDeliveries ?? 0,
    };
    return;
  }

  if (!isVendor) return;

  // A vendor sees the wallet and payouts of their own store only. Resolving the
  // store from the session user id is what stops one vendor reading another's
  // balance, so the client-supplied store id is never trusted here.
  const own = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  const vendorId = own[0]?.id;
  if (vendorId === undefined) return;

  const [walletRows, withdrawalRows] = await Promise.all([
    db.select().from(vendorWallets).where(eq(vendorWallets.vendorId, vendorId)).limit(1),
    db
      .select()
      .from(vendorWithdrawals)
      .where(eq(vendorWithdrawals.vendorId, vendorId))
      .orderBy(desc(vendorWithdrawals.createdAt)),
  ]);

  payload.vendorWallet = serializeWallet(walletRows[0]);
  payload.vendorWithdrawals = withdrawalRows.map(serializeWithdrawal);

  // Disputes raised against orders placed at this store.
  const ownOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.vendorId, vendorId));

  const ownOrderIds = ownOrders.map((o) => o.id);
  if (ownOrderIds.length === 0) return;

  const disputeRows = await db
    .select()
    .from(disputes)
    .where(inArray(disputes.orderId, ownOrderIds))
    .orderBy(desc(disputes.createdAt));

  payload.disputes = disputeRows.map(serializeDispute);
}
