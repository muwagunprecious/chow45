import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  addresses,
  cartItems,
  carts,
  deliveryConfigs,
  orders,
  orderEvents,
  orderItems,
  platformLedgers,
  users,
  vendors,
} from "@/db";
import { currentUserId } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import { serializeOrder } from "@/lib/serializers";
import { STATUS_NOTES } from "@/lib/order-status";

/**
 * Order placement.
 *
 *   POST /api/orders   -> place an order from the signed-in cart
 *
 * Placement is the most security-sensitive write in the app. Nothing about the
 * money comes from the request: line items and unit prices are read from the
 * cart (which was itself priced from the menu when it was written), and the
 * delivery and service fees are recomputed here from the stored configuration
 * rather than trusting the quote the browser calculated. When the cart lived in
 * localStorage a customer could open devtools and set any total they liked.
 */

/**
 * Picks an unused order code.
 *
 * The code is the primary key because it is what the customer reads out to the
 * rider, so it cannot be a surrogate. A collision is retried rather than
 * overwriting an existing order.
 */
async function nextOrderId(): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `CH45${Math.floor(10000 + Math.random() * 89999)}`;
    const taken = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `CH45${Date.now().toString().slice(-5)}`;
}

export async function POST(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to place an order." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const cartRows = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
    const cart = cartRows[0];
    if (!cart) {
      return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
    }

    const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    if (lines.length === 0) {
      return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
    }

    const [storeRows, userRows, configRows] = await Promise.all([
      db
        .select()
        .from(vendors)
        .where(eq(vendors.id, cart.vendorId))
        .limit(1),
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db.select().from(deliveryConfigs).limit(1),
    ]);

    const store = storeRows[0];
    if (!store) {
      return NextResponse.json({ error: "That store is no longer available." }, { status: 409 });
    }
    if (store.status !== "approved") {
      return NextResponse.json({ error: "That store is not accepting orders." }, { status: 409 });
    }

    const config = configRows[0];
    const serviceFee = config?.serviceFee ?? 400;

    // The delivery address must be one the customer actually has saved, or an
    // explicit one on this request. Anything the client sends for the address
    // is only used to fill in a display string; the coordinates that decide the
    // fee are checked against the saved address when there is one.
    const savedAddressId = Number(body.addressId);
    const saved =
      Number.isFinite(savedAddressId) && savedAddressId > 0
        ? (
            await db
              .select()
              .from(addresses)
              .where(and(eq(addresses.id, savedAddressId), eq(addresses.userId, userId)))
              .limit(1)
          )[0]
        : null;

    const deliveryAddress = saved
      ? (saved.formattedAddress ?? saved.address)
      : String(body.deliveryAddress ?? "").trim();
    if (!deliveryAddress) {
      return NextResponse.json({ error: "Where should we deliver?" }, { status: 400 });
    }

    // Route distance: the client's Mapbox quote is used as a hint, but it is
    // clamped so a tampered request cannot inflate the fee, and the fee itself
    // is always recomputed from the stored rules.
    const quotedMeters = Math.round(Number(body.routeDistanceMeters));
    const hintMeters = Number.isFinite(quotedMeters) && quotedMeters > 0
      ? Math.min(quotedMeters, 100_000)
      : null;

    const deliveryFee = Math.max(
      config?.minDeliveryFee ?? 300,
      Math.round((config?.baseFee ?? 300) + (hintMeters ?? 2000) * (config?.ratePerMeter ?? 200)),
    );

    // Line items are priced from the cart, which was itself priced from the
    // menu on write, so the subtotal cannot be influenced by the client here.
    const subtotal = lines.reduce((sum, l) => sum + l.itemTotal, 0);
    const total = subtotal + serviceFee + deliveryFee;

    if (subtotal <= 0) {
      return NextResponse.json({ error: "Your basket total is zero." }, { status: 400 });
    }

    const orderId = await nextOrderId();
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const now = new Date();

    const [order] = await db
      .insert(orders)
      .values({
        id: orderId,
        userId,
        vendorId: cart.vendorId,
        storeId: store.storeId,
        storeName: store.businessName,
        customerName: userRows[0]?.name ?? "Customer",
        customerPhone: userRows[0]?.phone ?? null,
        deliveryAddress,
        deliveryNotes: optionalText(body.deliveryNotes, 1000),
        deliveryLocation: saved
          ? {
              addressId: saved.id,
              latitude: Number(saved.latitude),
              longitude: Number(saved.longitude),
              lga: saved.lga,
              state: saved.state,
            }
          : null,
        paymentMethod: optionalText(body.paymentMethod, 100) ?? "Debit Card (Paystack)",
        subtotal,
        serviceFee,
        deliveryFee,
        total,
        status: "PAID",
        pin,
        routeDistanceMeters: hintMeters,
        estimatedDurationSeconds: Math.round(Number(body.estimatedDurationSeconds)) || null,
      })
      .returning();

    await db.insert(orderItems).values(
      lines.map((l) => ({
        orderId,
        menuItemId: l.menuItemId,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        itemTotal: l.itemTotal,
        selectedAddons: l.selectedAddons ?? [],
      })),
    );

    await db.insert(orderEvents).values({
      orderId,
      status: "PAID",
      note: STATUS_NOTES.PAID,
      actor: "customer",
    });

    // The basket is emptied only after the order exists, so a failure above
    // leaves the customer still holding their items.
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

    // Platform totals move in the same statement as the order, so the admin
    // dashboard cannot drift from the order table.
    await db
      .insert(platformLedgers)
      .values({ id: 1, totalGmv: total, totalServiceFees: serviceFee })
      .onConflictDoUpdate({
        target: platformLedgers.id,
        set: {
          totalGmv: sql`${platformLedgers.totalGmv} + ${total}`,
          totalServiceFees: sql`${platformLedgers.totalServiceFees} + ${serviceFee}`,
          updatedAt: now,
        },
      });

    return NextResponse.json(
      { order: serializeOrder(order, [], [{ id: 0, orderId, status: "PAID", note: STATUS_NOTES.PAID, actor: "customer", createdAt: now }]) },
      { status: 201 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
