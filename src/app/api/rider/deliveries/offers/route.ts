import { NextResponse } from "next/server";
import { eq, and, or, isNull, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema/orders";
import { vendors } from "@/db/schema/vendors";
import { requireRider } from "@/lib/session";

export async function GET(request: Request) {
  const auth = await requireRider(request, false);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { rider } = auth;

  if (!rider.isOnline) {
    return NextResponse.json({
      offers: [],
      isOnline: false,
      message: "Go online to receive delivery requests.",
    });
  }

  // Check if rider already has active mission
  const activeOrder = await db
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

  if (activeOrder.length > 0) {
    return NextResponse.json({
      offers: [],
      hasActiveDelivery: true,
      activeOrderId: activeOrder[0].id,
      message: "Complete your current delivery before accepting new offers.",
    });
  }

  // Fetch unassigned orders ready or preparing for pickup
  const candidateOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        or(isNull(orders.riderId), eq(orders.riderId, "")),
        inArray(orders.status, [
          "READY_FOR_PICKUP",
          "PREPARING",
          "RESTAURANT_ACCEPTED",
          "PAID",
        ])
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(10);

  const offers = await Promise.all(
    candidateOrders.map(async (order) => {
      // Get vendor store address
      let storeAddress = "Vendor Location";
      if (order.vendorId) {
        const v = await db
          .select({ address: vendors.address })
          .from(vendors)
          .where(eq(vendors.id, order.vendorId))
          .limit(1);
        if (v[0]?.address) storeAddress = v[0].address;
      }

      // Count items
      const items = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const itemCount = items.length;

      // Delivery earning for rider: rider gets delivery fee (minimum ₦800)
      const riderFee = Math.max(800, order.deliveryFee || 800);

      return {
        id: order.id,
        storeId: order.storeId,
        storeName: order.storeName,
        storeAddress,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        deliveryFee: riderFee,
        total: order.total,
        itemCount,
        status: order.status,
        createdAt: order.createdAt,
        estimatedDurationMinutes: order.estimatedDurationSeconds
          ? Math.round(order.estimatedDurationSeconds / 60)
          : 20,
      };
    })
  );

  return NextResponse.json({
    offers,
    isOnline: true,
    hasActiveDelivery: false,
  });
}
