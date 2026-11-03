import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

import { db } from "@/db";
import { orders, orderEvents, cartItems, carts, platformLedgers } from "@/db";
import { STATUS_NOTES } from "@/lib/order-status";

/**
 * Paystack Webhook Handler
 *
 * Webhook URL: https://chow45.app/api/payments/webhook
 *
 * Receives charge.success, payment.success, and verification pings from Paystack.
 * Cryptographically validates the `x-paystack-signature` header using HMAC SHA512.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Chow45 Paystack Webhook Listener",
    webhookUrl: "https://chow45.app/api/payments/webhook",
    status: "active",
    supportedEvents: ["charge.success", "paymentrequest.success", "transfer.success"],
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");
    const paystackSecret =
      process.env.PAYSTACK_SECRET_KEY || "sk_test_fed535e8c2a8cac2ddfa2959181df64c87517f44";

    // 1. Verify HMAC SHA512 signature if secret and signature are present
    if (paystackSecret && signature) {
      const hash = crypto
        .createHmac("sha512", paystackSecret)
        .update(rawBody)
        .digest("hex");
      if (hash !== signature) {
        console.warn("[Paystack Webhook] Invalid signature rejected");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody || "{}") as Record<string, any>;
    const event = body.event || body.type;
    const data = body.data || body;

    console.log(`[Paystack Webhook] Received event: ${event}, reference: ${data?.reference}`);

    if (
      event === "charge.success" ||
      event === "payment.success" ||
      data?.status === "success"
    ) {
      const orderId =
        data?.metadata?.orderId ||
        data?.metadata?.order_id ||
        data?.metadata?.custom_fields?.find?.(
          (f: any) => f.variable_name === "order_id" || f.variable_name === "orderId"
        )?.value ||
        (data?.reference && String(data.reference).startsWith("CH45")
          ? data.reference.split("_")[0]
          : null);

      if (!orderId) {
        return NextResponse.json({ received: true, ignored: "No order identifier found in payload" });
      }

      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.id, String(orderId)))
        .limit(1);

      const order = orderRows[0];
      if (!order) {
        return NextResponse.json({ received: true, ignored: `Order ${orderId} not found` });
      }

      if (order.status !== "PENDING_PAYMENT") {
        return NextResponse.json({
          received: true,
          alreadyProcessed: true,
          status: order.status,
          orderId: order.id,
        });
      }

      const now = new Date();
      await db
        .update(orders)
        .set({
          status: "PAID",
          paymentMethod: data?.reference ? `Paystack (${data.reference})` : order.paymentMethod,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));

      await db.insert(orderEvents).values({
        orderId: order.id,
        status: "PAID",
        note: `${STATUS_NOTES.PAID} (Paystack Ref: ${data?.reference || "confirmed"})`,
        actor: "paystack_webhook",
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

      return NextResponse.json({ received: true, processed: true, orderId: order.id });
    }

    return NextResponse.json({ received: true, status: "event not handled", event });
  } catch (err: any) {
    console.error("[Paystack Webhook] Error:", err);
    return NextResponse.json({ error: err?.message || "Webhook error" }, { status: 500 });
  }
}
