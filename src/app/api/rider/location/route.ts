import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { riders } from "@/db/schema/riders";
import { requireRider } from "@/lib/guards";
import { toLat, toCoord } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const check = await requireRider();
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden: Vendor access required." }, { status: 403 });
  }

    const rider = check.rider;

    const body = await request.json().catch(() => ({}));

    const lat = body.lat !== undefined ? toLat(body.lat) : body.currentLat !== undefined ? toLat(body.currentLat) : null;
    const lng = body.lng !== undefined ? toCoord(body.lng) : body.currentLng !== undefined ? toCoord(body.currentLng) : null;

    if (lat === null || lng === null) {
      return NextResponse.json({ error: "Valid latitude and longitude required." }, { status: 400 });
    }

    await db
      .update(riders)
      .set({
        currentLat: lat,
        currentLng: lng,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(riders.id, rider.id));

    return NextResponse.json({
      success: true,
      lat: Number(lat),
      lng: Number(lng),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
