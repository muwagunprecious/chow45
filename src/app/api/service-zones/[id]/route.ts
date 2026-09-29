import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { serviceZones } from "@/db";
import { currentRole } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import { serializeZone } from "@/lib/serializers";

/**
 * A single delivery zone.
 *
 *   PATCH /api/service-zones/:id   -> update the zone in place
 *   DELETE /api/service-zones/:id  -> remove it (zones are never hard-deleted
 *                                     unless truly dead; see below)
 *
 * The zone id is a stable handle generated when the zone is created, so an edit
 * keeps the same id and nothing that linked to it breaks. Deleting only flips
 * `isActive` to false so historic orders still have a zone to resolve against.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/service-zones/[id]">) {
  const role = await currentRole(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const found = await db
      .select()
      .from(serviceZones)
      .where(eq(serviceZones.id, String(id)))
      .limit(1);
    const zone = found[0];
    if (!zone) {
      return NextResponse.json({ error: "Zone not found." }, { status: 404 });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const name = optionalText(body.name, 255);
    if (name) patch.name = name;
    if (body.active !== undefined) patch.isActive = body.active === true;
    if (body.state !== undefined) patch.state = optionalText(body.state, 100);
    if (body.lga !== undefined) patch.lga = optionalText(body.lga, 100);
    if (body.center !== undefined && Array.isArray(body.center)) {
      const [lng, lat] = body.center as unknown[];
      if (lng !== undefined && lat !== undefined && Number.isFinite(Number(lng)) && Number.isFinite(Number(lat))) {
        patch.center = [Number(lng), Number(lat)];
      }
    }
    if (body.maxDeliveryDistance !== undefined) {
      patch.maxDeliveryDistance = Math.max(0, Number(body.maxDeliveryDistance) || 0);
    }
    if (body.deliveryRules !== undefined && body.deliveryRules && typeof body.deliveryRules === "object") {
      const r = body.deliveryRules as Record<string, unknown>;
      patch.deliveryRules = {
        baseFee: Number(r.baseFee) || zone.deliveryRules.baseFee,
        ratePerMeter: Number(r.ratePerMeter) || zone.deliveryRules.ratePerMeter,
        serviceFee: Number(r.serviceFee) || zone.deliveryRules.serviceFee,
      };
    }
    if (body.operatingHours && typeof body.operatingHours === "object") {
      const h = body.operatingHours as Record<string, unknown>;
      patch.operatingHours = {
        open: String(h.open ?? zone.operatingHours.open),
        close: String(h.close ?? zone.operatingHours.close),
      };
    }
    if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || zone.sortOrder;

    const [updated] = await db
      .update(serviceZones)
      .set(patch as never)
      .where(eq(serviceZones.id, zone.id))
      .returning();

    return NextResponse.json({ zone: serializeZone(updated) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/service-zones/[id]">) {
  const role = await currentRole(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const found = await db
      .select()
      .from(serviceZones)
      .where(eq(serviceZones.id, String(id)))
      .limit(1);
    const zone = found[0];
    if (!zone) {
      return NextResponse.json({ error: "Zone not found." }, { status: 404 });
    }

    const [updated] = await db
      .update(serviceZones)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(serviceZones.id, zone.id))
      .returning();

    return NextResponse.json({ zone: serializeZone(updated) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}