import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, orderEvents, cartItems, carts, platformLedgers } from "@/db";
import { STATUS_NOTES } from "@/lib/order-status";

/**
 * Payment provider webhook listener (e.g. Paystack / Flutterwave).
 *
 * Webhooks may retry multiple times, so execution is strictly idempotent.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const event = body.event || body.type;
    const data = body.data || body;

    if (
      event === "charge.success" ||
      event === "payment.success" ||
      data?.status === "success"
    ) {
      const orderId =
        data?.metadata?.orderId ||
        data?.reference ||
        data?.metadata?.custom_fields?.find?.((f: any) => f.variable_name === "order_id")?.value;

      if (!orderId) {
        return NextResponse.json({ received: true, ignored: "No order identifier found" });
      }

      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.id, String(orderId)))
        .limit(1);

      const order = orderRows[0];
      if (!order) {
        return NextResponse.json({ received: true, ignored: "Order not found" });
      }

      if (order.status !== "PENDING_PAYMENT") {
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }

      const now = new Date();
      await db
        .update(orders)
        .set({ status: "PAID", updatedAt: now })
        .where(eq(orders.id, order.id));

      await db.insert(orderEvents).values({
        orderId: order.id,
        status: "PAID",
        note: STATUS_NOTES.PAID,
        actor: "system",
      });

      const cartRow = await db
        .select()
        .from(carts)
        .where(eq(carts.userId, order.userId))
        .limit(1);

      if (cartRow[0]) {
        await db.delete(cartItems).where(eq(cartItems.cartId, cartRow[0].id));
      }

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

      return NextResponse.json({ received: true, processed: true });
    }

    return NextResponse.json({ received: true, status: "event not handled" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Webhook error" }, { status: 500 });
  }
}
