import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { riders } from "@/db/schema/riders";
import { orders } from "@/db/schema/orders";
import { requireRider } from "@/lib/session";
import { toLat, toCoord } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { rider } = auth;
  const body = await request.json().catch(() => ({}));
  const isOnline = Boolean(body.isOnline);

  let isAvailable = false;

  if (isOnline) {
    // Check if rider has active delivery
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

    isAvailable = activeOrder.length === 0;
  }

  const patch: Record<string, unknown> = {
    isOnline,
    isAvailable,
    applicationStatus: "APPROVED",
    approvalStatus: "APPROVED",
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  };

  const lat = body.lat !== undefined ? toLat(body.lat) : body.currentLat !== undefined ? toLat(body.currentLat) : null;
  const lng = body.lng !== undefined ? toCoord(body.lng) : body.currentLng !== undefined ? toCoord(body.currentLng) : null;
  if (lat !== null) patch.currentLat = lat;
  if (lng !== null) patch.currentLng = lng;

  await db.update(riders).set(patch as never).where(eq(riders.id, rider.id));

  return NextResponse.json({
    success: true,
    isOnline,
    isAvailable,
  });
}
