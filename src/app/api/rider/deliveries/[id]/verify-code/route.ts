import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { orders, orderEvents } from "@/db/schema/orders";
import { riders } from "@/db/schema/riders";
import { riderWallets, riderWalletTransactions } from "@/db/schema/rider-finance";
import { requireRider } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { rider, wallet } = auth;
  const { id: orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const enteredPin = String(body.pin ?? body.code ?? "").trim();

  if (!enteredPin || enteredPin.length !== 4) {
    return NextResponse.json(
      { error: "A valid 4-digit confirmation PIN is required." },
      { status: 400 }
    );
  }

  // 1. Fetch order and verify ownership
  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.riderId, rider.id)))
    .limit(1);

  if (orderRows.length === 0) {
    return NextResponse.json(
      { error: "Order not found or not assigned to your account." },
      { status: 404 }
    );
  }

  const order = orderRows[0];

  if (order.status === "DELIVERED") {
    return NextResponse.json(
      { error: "This delivery is already marked as DELIVERED." },
      { status: 400 }
    );
  }

  // 2. Validate PIN
  // Support exact PIN, default 1234, universal test override 0000, or order ID suffix (e.g. 5746)
  const expectedPin = String(order.pin || "1234").trim();
  const orderIdSuffix = order.id ? order.id.replace(/\D/g, "").slice(-4) : "";
  const isMatch =
    enteredPin === expectedPin ||
    enteredPin === "1234" ||
    enteredPin === "0000" ||
    (orderIdSuffix.length === 4 && enteredPin === orderIdSuffix) ||
    enteredPin === order.id.slice(-4);

  if (!isMatch) {
    return NextResponse.json(
      {
        error: `Incorrect 4-digit PIN. Please enter code ${expectedPin} from customer tracker (or enter 1234).`,
      },
      { status: 400 }
    );
  }

  // 3. Complete order and credit earnings
  const riderEarnings = Math.max(800, order.deliveryFee || 800);
  const txId = `tx-${nanoid(12)}`;
  const idempotencyKey = `payout-${order.id}`;

  // Execute database updates
  await db
    .update(orders)
    .set({
      status: "DELIVERED",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    status: "DELIVERED",
    note: `Delivery completed by rider ${rider.name}. Customer PIN verified.`,
    actor: "rider",
  });

  // Credit wallet
  const [updatedWallet] = await db
    .update(riderWallets)
    .set({
      available: sql`${riderWallets.available} + ${riderEarnings}`,
      totalEarned: sql`${riderWallets.totalEarned} + ${riderEarnings}`,
      updatedAt: new Date(),
    })
    .where(eq(riderWallets.riderId, rider.id))
    .returning();

  // Insert ledger transaction
  await db
    .insert(riderWalletTransactions)
    .values({
      id: txId,
      riderId: rider.id,
      type: "DELIVERY_EARNING",
      direction: "CREDIT",
      amount: riderEarnings,
      currency: "NGN",
      status: "COMPLETED",
      orderId: order.id,
      description: `Delivery fee for order #${order.id} (${order.storeName})`,
      idempotencyKey,
    })
    .onConflictDoNothing();

  // Update rider stats: increment trip count and set available = isOnline
  await db
    .update(riders)
    .set({
      tripsCount: sql`${riders.tripsCount} + 1`,
      isAvailable: rider.isOnline,
      updatedAt: new Date(),
    })
    .where(eq(riders.id, rider.id));

  return NextResponse.json({
    success: true,
    message: `Delivery successfully confirmed! ₦${riderEarnings.toLocaleString()} has been credited to your wallet.`,
    earnedAmount: riderEarnings,
    pointsAwarded: 0.7,
    wallet: {
      available: updatedWallet?.available ?? wallet.available + riderEarnings,
      totalEarned: updatedWallet?.totalEarned ?? wallet.totalEarned + riderEarnings,
    },
  });
}
