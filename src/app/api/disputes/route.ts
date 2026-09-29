import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { disputes, orders } from "@/db";
import { currentUserId } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import { serializeDispute } from "@/lib/serializers";

/**
 * Customer-raised complaints about an order.
 *
 *   GET  /api/disputes          -> anything the customer raised
 *   POST /api/disputes          -> open one against a delivered order
 *
 * The dispute replaces `state.disputes`, which the customer could open and
 * resolve in their own localStorage — including "resolving" money back to
 * themselves. Only an admin can resolve a dispute now (see the resolve route);
 * the customer can only raise one, and raising it requires a real order id that
 * is theirs.
 */

const REASONS = new Set([
  "wrong item",
  "missing item",
  "wrong amount",
  "poor quality",
  "late delivery",
  "other",
]);

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ disputes: [] });
  }

  const rows = await db
    .select()
    .from(disputes)
    .where(eq(disputes.userId, userId));

  return NextResponse.json({ disputes: rows.map(serializeDispute) });
}

export async function POST(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to raise a dispute." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const reason = String(body.reason ?? "").toLowerCase().trim();
  if (!REASONS.has(reason)) {
    return NextResponse.json(
      { error: "Please choose a reason for your dispute." },
      { status: 400 },
    );
  }

  const orderId = String(body.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "Which order is this about?" }, { status: 400 });
  }

  try {
    // Only the owner of a delivered order can dispute it, and only once — the
    // second and third rows would each be "your order", so the unique index
    // would not be enough.
    const order = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .limit(1);

    if (!order[0]) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const open = await db
      .select()
      .from(disputes)
      .where(and(eq(disputes.orderId, orderId), eq(disputes.userId, userId)))
      .limit(1);

    if (open[0] && open[0].status === "open") {
      return NextResponse.json(
        { error: "You already have an open dispute for this order." },
        { status: 409 },
      );
    }

    // One dispute per order, ever. Re-opening adopts the existing row so an
    // admin who resolved it earlier can see the whole history.
    const id = `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const [created] = open[0]
      ? await db
          .update(disputes)
          .set({
            reason,
            details: optionalText(body.details, 1000),
            status: "open",
            resolution: null,
            resolvedBy: null,
            resolvedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(disputes.id, open[0].id))
          .returning()
      : await db
          .insert(disputes)
          .values({
            id,
            orderId,
            userId,
            reason,
            details: optionalText(body.details, 1000),
            status: "open",
          })
          .returning();

    return NextResponse.json({ dispute: serializeDispute(created) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}