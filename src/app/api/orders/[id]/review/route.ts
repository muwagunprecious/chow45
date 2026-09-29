import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db";
import { currentUserId } from "@/lib/session";
import { clampInt, optionalText } from "@/lib/validation";

/**
 * Rates a delivered order.
 *
 *   POST /api/orders/:id/review   { rating, comment }
 *
 * Reviews are written straight onto the order, so a rating cannot be left
 * orphaned by an order being deleted, and a delivered order has at most one
 * review. A second submission overwrites the first rather than accumulating,
 * matching what the order screen showed when this was a local object.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/orders/[id]/review">) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to leave a review." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const orderId = String(id);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Stars are whole numbers 1-5. The clamp keeps a hostile value out of the
  // column and out of the average.
  const rating = clampInt(body.rating, 1, 5, 0);
  if (rating === 0) {
    return NextResponse.json({ error: "Please choose a rating from 1 to 5." }, { status: 400 });
  }

  try {
    const found = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .limit(1);

    const order = found[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "You can only review an order that has been delivered." },
        { status: 409 },
      );
    }

    const [updated] = await db
      .update(orders)
      .set({
        rating,
        reviewComment: optionalText(body.comment, 1000),
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    return NextResponse.json({ order: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
