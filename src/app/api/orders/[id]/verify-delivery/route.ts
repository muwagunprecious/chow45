import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, orderEvents, platformLedgers } from "@/db";
import { currentUserId } from "@/lib/session";

/**
 * Server-side delivery PIN verification.
 *
 * Never trust the frontend client to declare DELIVERED without verifying
 * the 4-digit security code against the order record.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const orderId = String(id);

  let body: Record<string, unknown>;
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const enteredPin = String(body.pin || "").trim();
  if (!enteredPin || enteredPin.length !== 4) {
    return NextResponse.json(
      { error: "Please provide the complete 4-digit PIN." },
      { status: 400 }
    );
  }

  try {
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    const order = orderRows[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Order has already been delivered." },
        { status: 409 }
      );
    }

    // Security Verification: 4-digit PIN check
    if (order.pin && order.pin !== enteredPin) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_PIN",
          message: "Incorrect 4-digit PIN! Please ask the customer for their code.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(orders)
      .set({
        status: "DELIVERED",
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning();

    await db.insert(orderEvents).values({
      orderId,
      status: "DELIVERED",
      note: "Customer 4-digit PIN verified. Order successfully delivered.",
      actor: "rider",
    });

    await db
      .insert(platformLedgers)
      .values({ id: 1 })
      .onConflictDoUpdate({
        target: platformLedgers.id,
        set: {
          completedDeliveries: sql`${platformLedgers.completedDeliveries} + 1`,
          updatedAt: now,
        },
      });

    return NextResponse.json({
      success: true,
      order: updated,
      message: "Delivery code verified and order delivered successfully!",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
