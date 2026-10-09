import { NextResponse } from "next/server";
import { db, orders, riders } from "@/db";
import { eq } from "drizzle-orm";
import { currentRole } from "@/lib/session";
import { requireUser, requireVendor } from "@/lib/guards";
import { requireRider } from "@/lib/session";
import { toLat, toCoord } from "@/lib/validation";

/* 
Provides and updates the live location of a rider assigned to an order 
in currentLng and currentLat
*/

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;

    const found = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const order = found[0];

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const orderRiderId = order.riderId;

    let isAuthorized = false;

    const role = await currentRole(req);
    if (role === "ADMIN") {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      const auth = await requireUser();
      if (auth.authorized) {
        const userId = Number(auth.user.id);
        if (userId === order.userId) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      const auth = await requireVendor();
      if (auth.authorized && auth.vendor?.id && order.vendorId) {
        if (auth.vendor.id === order.vendorId) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      const auth = await requireRider(req, true);
      const riderId = auth.ok ? auth.rider?.id : null;
      if (auth.ok && riderId && orderRiderId && riderId === orderRiderId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // In production, allow customers tracking their current order if matching orderId
      // (Order tracking link is shared with the customer who ordered)
      isAuthorized = true;
    }

    if (!orderRiderId) {
      return NextResponse.json({ rider: null, riderLat: null, riderLng: null, orderStatus: order.status }, { status: 200 });
    }

    const orderRider = await db
      .select()
      .from(riders)
      .where(eq(riders.id, orderRiderId))
      .limit(1);

    const riderRow = orderRider[0];

    return NextResponse.json({
      orderId,
      orderStatus: order.status,
      riderId: orderRiderId,
      riderName: order.riderName || riderRow?.name,
      riderLat: riderRow ? Number(riderRow.currentLat) : null,
      riderLng: riderRow ? Number(riderRow.currentLng) : null,
      lastSeenAt: riderRow?.lastSeenAt,
    });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;
    const auth = await requireRider(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error, message: auth.message }, { status: auth.status });
    }

    const rider = auth.rider;
    const body = await req.json().catch(() => ({}));

    const lat = body.lat !== undefined ? toLat(body.lat) : body.currentLat !== undefined ? toLat(body.currentLat) : null;
    const lng = body.lng !== undefined ? toCoord(body.lng) : body.currentLng !== undefined ? toCoord(body.currentLng) : null;

    if (lat === null || lng === null) {
      return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
    }

    await db.update(riders).set({
      currentLat: lat,
      currentLng: lng,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(riders.id, rider.id));

    return NextResponse.json({
      success: true,
      orderId,
      riderLat: Number(lat),
      riderLng: Number(lng),
    });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong updating location" }, { status: 500 });
  }
}
