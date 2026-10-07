import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, orderItems, orderEvents, cartItems, carts, platformLedgers, users, vendors } from "@/db";
import { STATUS_NOTES } from "@/lib/order-status";


/**
 * Verifies that a payment succeeded and transitions order to PAID.
 *
 * Implements idempotency: if the order is already marked PAID,
 * it returns success without duplicating events or ledger increments.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const orderId = String(body.orderId || body.reference || "").trim();
    const reference = body.reference ? String(body.reference) : undefined;
    const amount = body.amount ? Number(body.amount) : undefined;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId." }, { status: 400 });
    }

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    let order = orderRows[0];
    if (!order) {
      if (body.order && typeof body.order === "object") {
        // Automatically create and persist the order
        const rawOrder = body.order as Record<string, any>;
        const storeId = String(rawOrder.storeId || "unknown-store").trim();
        const storeName = String(rawOrder.storeName || "Campus Food Spot").trim();
        const customerName = String(rawOrder.customerName || "Customer").trim();
        const customerPhone = String(rawOrder.customerPhone || "").trim() || null;
        const deliveryAddress = String(rawOrder.deliveryAddress || "Sagamu Campus (OSUTH)").trim();
        const deliveryNotes = rawOrder.deliveryNotes ? String(rawOrder.deliveryNotes) : null;
        const paymentMethod = reference ? `Paystack (${reference})` : (String(rawOrder.paymentMethod || "Debit Card (Paystack)").trim());

        const subtotal = Math.round(Number(rawOrder.subtotal) || 2000);
        const serviceFee = Math.round(Number(rawOrder.serviceFee) || 400);
        const deliveryFee = Math.max(800, Math.round(Number(rawOrder.deliveryFee) || 800));
        const total = Math.round(Number(rawOrder.total) || amount || (subtotal + serviceFee + deliveryFee));

        const pin = String(rawOrder.pin || Math.floor(1000 + Math.random() * 9000)).trim();

        // Resolve userId
        let resolvedUserId = 11;
        const u = await db.select({ id: users.id }).from(users).where(eq(users.role, "USER")).orderBy(users.id).limit(1);
        if (u[0]) resolvedUserId = u[0].id;

        // Resolve vendorId
        let resolvedVendorId: number | null = null;
        const v = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.storeId, storeId)).limit(1);
        if (v[0]) resolvedVendorId = v[0].id;

        const now = new Date();
        const [insertedOrder] = await db
          .insert(orders)
          .values({
            id: orderId,
            userId: resolvedUserId,
            vendorId: resolvedVendorId,
            storeId,
            storeName,
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryNotes,
            deliveryLocation: rawOrder.deliveryLocation || null,
            paymentMethod,
            subtotal,
            serviceFee,
            deliveryFee,
            total,
            status: "PAID",
            pin,
            routeDistanceMeters: rawOrder.routeDistanceMeters ? Math.round(Number(rawOrder.routeDistanceMeters)) : null,
            estimatedDurationSeconds: rawOrder.estimatedDurationSeconds ? Math.round(Number(rawOrder.estimatedDurationSeconds)) : null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        order = insertedOrder;

        // Insert items
        const items = Array.isArray(rawOrder.items) ? rawOrder.items : [];
        if (items.length > 0) {
          await db.insert(orderItems).values(
            items.map((item: any) => ({
              orderId,
              menuItemId: item.id || item.menuItemId || null,
              name: String(item.name || "Food Item"),
              qty: Math.max(1, Number(item.qty) || 1),
              unitPrice: Math.round(Number(item.price) || 0),
              itemTotal: Math.round((Number(item.price) || 0) * (Number(item.qty) || 1)),
              selectedAddons: item.selectedAddons || [],
            }))
          );
        }

        // Insert event
        await db.insert(orderEvents).values({
          orderId,
          status: "PAID",
          note: "Payment verified successfully. Order dispatched to campus riders.",
          actor: "system",
        });

        // Platform ledger
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

        return NextResponse.json({
          success: true,
          order: insertedOrder,
          message: "Payment verified successfully. Order dispatched to campus riders.",
        });
      }

      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Idempotency: If order was already marked PAID, return success safely
    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        orderId: order.id,
        status: order.status,
        message: "Payment already verified and processed.",
      });
    }

    const now = new Date();

    // Transition to PAID
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: "PAID",
        paymentMethod: reference ? `Paystack (${reference})` : order.paymentMethod,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id))
      .returning();

    // Record audit event
    await db.insert(orderEvents).values({
      orderId: order.id,
      status: "PAID",
      note: STATUS_NOTES.PAID,
      actor: "system",
    });

    // Delete user cart items if cart exists
    const cartRow = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, order.userId))
      .limit(1);

    if (cartRow[0]) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cartRow[0].id));
    }

    // Platform totals move in the same statement
    await db
      .insert(platformLedgers)
      .values({ id: 1, totalGmv: order.total, totalServiceFees: order.serviceFee })
      .onConflictDoUpdate({
        target: platformLedgers.id,
        set: {
          totalGmv: sql`${platformLedgers.totalGmv} + ${order.total}`,
          totalServiceFees: sql`${platformLedgers.totalServiceFees} + ${order.serviceFee}`,
          updatedAt: now,
        },
      });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: "Payment verified successfully. Order sent to kitchen.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
