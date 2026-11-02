import { NextResponse } from "next/server";
import { eq, and, or, isNull, inArray, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema/orders";
import { vendors } from "@/db/schema/vendors";
import { requireRider } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const auth = await requireRider(request, true);
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

    // Fetch unassigned orders ready or preparing for pickup with vendor details joined
    const candidateRows = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        storeName: orders.storeName,
        vendorId: orders.vendorId,
        vendorAddress: vendors.address,
        vendorLocation: vendors.location,
        vendorPhone: vendors.ownerPhone,
        customerName: orders.customerName,
        deliveryAddress: orders.deliveryAddress,
        deliveryNotes: orders.deliveryNotes,
        deliveryFee: orders.deliveryFee,
        total: orders.total,
        status: orders.status,
        isPreorder: orders.isPreorder,
        preorderReadyDate: orders.preorderReadyDate,
        preorderReadyTime: orders.preorderReadyTime,
        isFoodReady: orders.isFoodReady,
        foodReadyAt: orders.foodReadyAt,
        createdAt: orders.createdAt,
        estimatedDurationSeconds: orders.estimatedDurationSeconds,
      })
      .from(orders)
      .leftJoin(vendors, or(eq(orders.vendorId, vendors.id), eq(orders.storeId, vendors.storeId)))
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

    let itemCountMap = new Map<string, number>();

    if (candidateRows.length > 0) {
      const orderIds = candidateRows.map((r) => r.id);
      try {
        const counts = await db
          .select({
            orderId: orderItems.orderId,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
          .groupBy(orderItems.orderId);

        for (const c of counts) {
          if (c.orderId) {
            itemCountMap.set(c.orderId, c.count);
          }
        }
      } catch (countErr) {
        console.warn("Non-fatal: Failed to batch count order items:", countErr);
      }
    }

    const offers = candidateRows.map((order) => {
      // Delivery earning for rider: rider gets the delivery fee paid by the customer
      const riderFee = Number(order.deliveryFee) || 0;

      const resolvedPickupAddress =
        order.vendorAddress ||
        order.vendorLocation ||
        "Sagamu Campus Kitchen / Restaurant";

      return {
        id: order.id,
        storeId: order.storeId,
        storeName: order.storeName,
        storeAddress: resolvedPickupAddress,
        vendorPhone: order.vendorPhone || null,
        customerName: order.customerName || "Customer",
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        deliveryFee: riderFee,
        total: order.total,
        itemCount: itemCountMap.get(order.id) || 1,
        status: order.status,
        isPreorder: order.isPreorder ?? false,
        preorderReadyDate: order.preorderReadyDate ?? null,
        preorderReadyTime: order.preorderReadyTime ?? null,
        isFoodReady: order.isFoodReady ?? false,
        foodReadyAt: order.foodReadyAt ? order.foodReadyAt.toISOString() : null,
        createdAt: order.createdAt,
        estimatedDurationMinutes: order.estimatedDurationSeconds
          ? Math.round(order.estimatedDurationSeconds / 60)
          : 20,
      };
    });

    return NextResponse.json(
      {
        offers,
        isOnline: true,
        hasActiveDelivery: false,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Error fetching rider delivery offers:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: err?.message || "Failed to load offers", offers: [] },
      { status: 500 }
    );
  }
}
