import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { riders } from "@/db";
import { currentRole, currentUserId } from "@/lib/session";
import { toLat, toCoord } from "@/lib/validation";
import { serializeRider } from "@/lib/serializers";

/**
 * A rider's live state.
 *
 *   PATCH /api/riders/:id   { online?, available?, lat?, lng? }
 *
 * Only the rider's own account (the row linked to the signed-in user) or an
 * admin can change it. Previously the rider's toggle flipped a boolean in
 * localStorage that the marketplace in another tab could not even read; now the
 * customer-facing availability comes from the same row.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/riders/[id]">) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const riderId = String(id);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const found = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    const rider = found[0];
    if (!rider) {
      return NextResponse.json({ error: "Rider not found." }, { status: 404 });
    }

    const role = await currentRole(request);
    const isSelf = rider.userId === userId;
    const isAdmin = role === "ADMIN";
    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: "You can only update your own rider profile." }, { status: 403 });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.online !== undefined) patch.isOnline = body.online === true;
    if (body.available !== undefined) patch.isAvailable = body.available === true;
    // Going offline while mid-drop is the dispatch team's concern, but a toggle
    // that only ever moves one direction is a footgun: let them set it either way.
    if (body.isOnline !== undefined) patch.isOnline = body.isOnline === true;
    if (body.isAvailable !== undefined) patch.isAvailable = body.isAvailable === true;

    const lat = body.lat !== undefined ? toLat(body.lat) : body.currentLat !== undefined ? toLat(body.currentLat) : null;
    const lng = body.lng !== undefined ? toCoord(body.lng) : body.currentLng !== undefined ? toCoord(body.currentLng) : null;
    if (lat !== null) patch.currentLat = lat;
    if (lng !== null) patch.currentLng = lng;

    const [updated] = await db
      .update(riders)
      .set(patch as never)
      .where(eq(riders.id, riderId))
      .returning();

    return NextResponse.json({ rider: serializeRider(updated) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}