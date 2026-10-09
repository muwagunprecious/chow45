import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { riders } from "@/db/schema/riders";
import { requireRider } from "@/lib/session";
import { toLat, toCoord } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const auth = await requireRider(request, true);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error, message: auth.message },
        { status: auth.status }
      );
    }

    const { rider } = auth;
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
