import { NextResponse } from "next/server";
import { eq, and, inArray, gte } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema/orders";
import { vendors } from "@/db/schema/vendors";
import { riderWalletTransactions } from "@/db/schema/rider-finance";
import { requireRider } from "@/lib/session";

export async function GET(request: Request) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message, applicationStatus: auth.applicationStatus },
      { status: auth.status }
    );
  }

  const { rider, wallet, user } = auth;

  // Find active delivery if any
  const activeOrderRows = await db
    .select()
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

  let activeDelivery = null;
  if (activeOrderRows.length > 0) {
    const order = activeOrderRows[0];
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    // Get vendor phone / address
    let vendorInfo = null;
    if (order.vendorId) {
      const vendorRows = await db
        .select({
          id: vendors.id,
          businessName: vendors.businessName,
          address: vendors.address,
          ownerPhone: vendors.ownerPhone,
          contactEmail: vendors.contactEmail,
        })
        .from(vendors)
        .where(eq(vendors.id, order.vendorId))
        .limit(1);
      vendorInfo = vendorRows[0] || null;
    }

    activeDelivery = {
      ...order,
      items,
      vendor: vendorInfo,
    };
  }

  // Calculate today's stats
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayTransactions = await db
    .select()
    .from(riderWalletTransactions)
    .where(
      and(
        eq(riderWalletTransactions.riderId, rider.id),
        eq(riderWalletTransactions.type, "DELIVERY_EARNING"),
        gte(riderWalletTransactions.createdAt, startOfDay)
      )
    );

  const todayEarnings = todayTransactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);
  const todayTrips = todayTransactions.length;

  return NextResponse.json({
    rider: {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      email: user.email,
      vehicle: rider.vehicle,
      avatar: rider.avatar,
      location: rider.location,
      identityMethod: rider.identityMethod,
      identityNumber: rider.identityNumber ? `***${rider.identityNumber.slice(-4)}` : null,
      institution: rider.institution,
      applicationStatus: rider.applicationStatus,
      approvalStatus: rider.approvalStatus,
      rejectionReason: rider.rejectionReason,
      suspensionReason: rider.suspensionReason,
      isOnline: rider.isOnline,
      isAvailable: rider.isAvailable,
      rating: rider.rating,
      tripsCount: rider.tripsCount,
      approvedAt: rider.approvedAt,
    },
    wallet: {
      available: wallet.available,
      processing: wallet.processing,
      totalEarned: wallet.totalEarned,
      currency: wallet.currency,
    },
    stats: {
      todayEarnings,
      todayTrips,
      rating: rider.rating,
      allTimeTrips: rider.tripsCount,
    },
    activeDelivery,
  });
}
