import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, orderEvents, cartItems, carts, platformLedgers } from "@/db";
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

    const order = orderRows[0];
    if (!order) {
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
