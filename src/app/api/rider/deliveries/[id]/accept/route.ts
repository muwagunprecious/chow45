import { NextResponse } from "next/server";
import { eq, and, or, isNull, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderEvents } from "@/db/schema/orders";
import { riders } from "@/db/schema/riders";
import { vendors } from "@/db/schema/vendors";
import { requireRider } from "@/lib/session";

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

  // 1. Check if rider is online
  if (!rider.isOnline) {
    return NextResponse.json(
      { error: "You must be online to accept delivery offers." },
      { status: 400 }
    );
  }

  // 2. Check if rider already has an active delivery
  const existingActive = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.riderId, rider.id),
        inArray(orders.status, [
          "RIDER_ASSIGNED",
          "RIDER_HEADING_TO_STORE",
          "RIDER_AT_STORE",
          "PICKED_UP",
          "OUT_FOR_DELIVERY",
          "RIDER_NEARBY",
        ])
      )
    )
    .limit(1);

  if (existingActive.length > 0) {
    return NextResponse.json(
      { error: "You already have an active delivery in progress. Complete it first." },
      { status: 400 }
    );
  }

  // 3. Concurrency-safe atomic assign
  const updateResult = await db
    .update(orders)
    .set({
      riderId: rider.id,
      riderName: rider.name,
      status: "RIDER_ASSIGNED",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        or(isNull(orders.riderId), eq(orders.riderId, ""))
      )
    )
    .returning();

  if (updateResult.length === 0) {
    return NextResponse.json(
      { error: "This delivery offer is no longer available or was accepted by another rider." },
      { status: 409 }
    );
  }

  const assignedOrder = updateResult[0];

  // 4. Mark rider unavailable while fulfilling order
  await db
    .update(riders)
    .set({ isAvailable: false, updatedAt: new Date() })
    .where(eq(riders.id, rider.id));

  // 5. Append audit event
  await db.insert(orderEvents).values({
    orderId: assignedOrder.id,
    status: "RIDER_ASSIGNED",
    note: `Rider ${rider.name} accepted the delivery offer.`,
    actor: "rider",
  });

  // 6. Fetch line items and vendor contact details
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, assignedOrder.id));

  let vendorInfo = null;
  if (assignedOrder.vendorId) {
    const v = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        address: vendors.address,
        ownerPhone: vendors.ownerPhone,
        contactEmail: vendors.contactEmail,
      })
      .from(vendors)
      .where(eq(vendors.id, assignedOrder.vendorId))
      .limit(1);
    vendorInfo = v[0] || null;
  }

  return NextResponse.json({
    success: true,
    message: "Delivery offer accepted! Proceed to the restaurant.",
    delivery: {
      ...assignedOrder,
      items,
      vendor: vendorInfo,
    },
  });
}
