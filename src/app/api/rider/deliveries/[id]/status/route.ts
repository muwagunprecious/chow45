import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderEvents } from "@/db/schema/orders";
import { requireRider } from "@/lib/session";

const ALLOWED_RIDER_STATUSES = [
  "RIDER_HEADING_TO_STORE",
  "RIDER_AT_STORE",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "RIDER_NEARBY",
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRider(request, false);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { rider } = auth;
  const { id: orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const targetStatus = String(body.status ?? "").trim();
  const note = String(body.note ?? "").trim();

  if (!ALLOWED_RIDER_STATUSES.includes(targetStatus as any)) {
    return NextResponse.json(
      {
        error: `Invalid status transition: '${targetStatus}'. To mark delivered, use the PIN verification step.`,
      },
      { status: 400 }
    );
  }

  // Find order and confirm ownership
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
      { error: "Order is already delivered." },
      { status: 400 }
    );
  }

  // Update order status
  const [updatedOrder] = await db
    .update(orders)
    .set({
      status: targetStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  // Add event
  const statusLabels: Record<string, string> = {
    RIDER_HEADING_TO_STORE: "Rider is heading to the restaurant",
    RIDER_AT_STORE: "Rider arrived at the restaurant",
    PICKED_UP: "Rider picked up the order",
    OUT_FOR_DELIVERY: "Rider is en route to customer drop-off",
    RIDER_NEARBY: "Rider has arrived at the drop-off location",
  };

  await db.insert(orderEvents).values({
    orderId,
    status: targetStatus,
    note: note || statusLabels[targetStatus] || `Status updated to ${targetStatus}`,
    actor: "rider",
  });

  return NextResponse.json({
    success: true,
    status: updatedOrder.status,
    delivery: updatedOrder,
  });
}
