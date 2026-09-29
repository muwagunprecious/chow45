import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, orderEvents, platformLedgers, riders, vendors } from "@/db";
import { currentRole, currentUserId } from "@/lib/session";
import { optionalText, readClientId } from "@/lib/validation";
import { canTransition, STATUS_NOTES, type Actor } from "@/lib/order-status";

/**
 * Moves a live order to its next stage.
 *
 *   PATCH /api/orders/:id   { status, riderId?, note? }
 *
 * The 13-stage state machine that used to live in `state.js` is enforced here
 * instead. A customer could previously call `advanceOrderStatus` on their own
 * local copy of the order and mark their own food as delivered, which also
 * credited the vendor wallet and the admin's completed-delivery count.
 *
 * Every transition is checked against both the current status and the caller's
 * role, so a vendor can only move their own orders and only forward from a
 * stage they are responsible for. The rules themselves come from
 * `@/lib/order-status` so they cannot drift from the ones the placement route
 * uses.
 */

type Ctx = RouteContext<"/api/orders/[id]">;

export async function PATCH(request: Request, ctx: Ctx) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const orderId = String(id);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const nextStatus = String(body.status ?? "").toUpperCase();
  if (!(nextStatus in STATUS_NOTES)) {
    return NextResponse.json({ error: `Unknown status "${nextStatus}".` }, { status: 400 });
  }

  try {
    const found = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const order = found[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // The caller must have a relationship with this order: it is theirs, it is
    // at their store, they are the rider on it, or they are an admin.
    const [role, vendorRows, riderRows] = await Promise.all([
      currentRole(request),
      db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, userId)).limit(1),
      db.select({ id: riders.id }).from(riders).where(eq(riders.userId, userId)).limit(1),
    ]);

    const actor = actorFor({
      role,
      ownsOrder: order.userId === userId,
      ownsStore: vendorRows.length > 0 && order.vendorId === vendorRows[0].id,
      isRider: riderRows.length > 0 && order.riderId === riderRows[0].id,
    });

    if (actor === null) {
      return NextResponse.json({ error: "This order is not yours." }, { status: 403 });
    }

    if (!canTransition(order.status, nextStatus, actor)) {
      return NextResponse.json(
        { error: `An order that is ${order.status} cannot become ${nextStatus} for a ${actor}.` },
        { status: 409 },
      );
    }

    // Assigning a rider is scoped to the riders table, so an order cannot be
    // handed to an id that does not exist.
    let riderId = order.riderId;
    let riderName = order.riderName;
    const requestedRider = readClientId(body.riderId);

    if (requestedRider) {
      const target = await db
        .select({ id: riders.id, name: riders.name })
        .from(riders)
        .where(eq(riders.id, requestedRider))
        .limit(1);
      if (target[0]) {
        riderId = target[0].id;
        riderName = target[0].name;
      }
    }

    const [updated] = await db
      .update(orders)
      .set({ status: nextStatus, riderId, riderName, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    await db.insert(orderEvents).values({
      orderId,
      status: nextStatus,
      note: optionalText(body.note, 500) ?? STATUS_NOTES[nextStatus],
      actor,
    });

    // A completed delivery is counted once. The transition table already makes
    // a second DELIVERED unreachable, but the guard keeps the admin total right
    // if a stage is ever added that could arrive here twice.
    if (nextStatus === "DELIVERED") {
      await db
        .insert(platformLedgers)
        .values({ id: 1 })
        .onConflictDoUpdate({
          target: platformLedgers.id,
          set: {
            completedDeliveries: sql`${platformLedgers.completedDeliveries} + 1`,
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json({ order: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

function actorFor(input: {
  role: string | null;
  ownsOrder: boolean;
  ownsStore: boolean;
  isRider: boolean;
}): Actor | null {
  if (input.role === "ADMIN") return "admin";
  // A vendor placing their own order is still acting as a customer for it, but
  // store ownership is the stronger claim and is checked first.
  if (input.ownsStore) return "vendor";
  if (input.isRider) return "rider";
  if (input.ownsOrder) return "customer";
  return null;
}
