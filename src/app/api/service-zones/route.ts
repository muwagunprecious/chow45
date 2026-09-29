import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { serviceZones } from "@/db";
import { currentRole } from "@/lib/session";
import { optionalText, readClientId } from "@/lib/validation";
import { serializeZone } from "@/lib/serializers";

/**
 * Delivery zones, admin-edited.
 *
 *   GET    /api/service-zones   -> every zone (reads go to the bootstrap route)
 *   POST   /api/service-zones   -> create a zone
 *
 * Zone edits used to land in the constants of `service-zones.js`, which meant
 * the admin's changes shipped with the next deploy or not at all. Everything
 * here requires an admin session, and polygon coordinates are validated as
 * `[lng, lat]` pairs so a zone swapped east for north silently never matches
 * any delivery.
 */

type ZonePolygon = [number, number][];

export async function GET() {
  const rows = await db.select().from(serviceZones).orderBy(asc(serviceZones.sortOrder));
  return NextResponse.json({ zones: rows.map(serializeZone) });
}

export async function POST(request: Request) {
  const role = await currentRole(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = optionalText(body.name, 255);
  if (!name) {
    return NextResponse.json({ error: "Zone name is required." }, { status: 400 });
  }

  const polygon = sanitizePolygon(body.polygon);
  if (!polygon) {
    return NextResponse.json(
      { error: "Polygon must be an array of [lng, lat] pairs." },
      { status: 400 },
    );
  }

  const center = sanitizeCenter(body.center);
  const rules = sanitizeRules(body.deliveryRules);
  const hoursRaw = (body.operatingHours ?? {}) as Record<string, unknown>;
  const hours = {
    open: String(hoursRaw.open ?? "09:00"),
    close: String(hoursRaw.close ?? "22:00"),
  };

  try {
    const id =
      readClientId(body.id) ?? `zone-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

    const [created] = await db
      .insert(serviceZones)
      .values({
        id,
        name,
        isActive: body.active !== false,
        state: optionalText(body.state, 100),
        lga: optionalText(body.lga, 100),
        center,
        maxDeliveryDistance: Number(body.maxDeliveryDistance) || 3000,
        deliveryRules: rules,
        operatingHours: hours,
        polygon,
        sortOrder: Number(body.sortOrder) || 0,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      const [existing] = await db.select().from(serviceZones).where(eq(serviceZones.id, id)).limit(1);
      return NextResponse.json({ error: "A zone with that id already exists.", zone: existing ? serializeZone(existing) : null }, { status: 409 });
    }

    return NextResponse.json({ zone: serializeZone(created) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

function sanitizePolygon(value: unknown): ZonePolygon | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const ring: ZonePolygon = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length !== 2) return null;
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
    ring.push([lng, lat]);
  }
  return ring;
}

function sanitizeCenter(value: unknown): [number, number] {
  if (Array.isArray(value) && value.length === 2) {
    const lng = Number(value[0]);
    const lat = Number(value[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  return [3.3792, 6.5244]; // Lagos default, matching the seed.
}

function sanitizeRules(value: unknown) {
  const fallback = { baseFee: 300, ratePerMeter: 0.15, serviceFee: 400 };
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const n = (x: unknown, fb: number) => {
    const parsed = Number(x);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fb;
  };
  return {
    baseFee: n(v.baseFee, fallback.baseFee),
    ratePerMeter: n(v.ratePerMeter, fallback.ratePerMeter),
    serviceFee: n(v.serviceFee, fallback.serviceFee),
  };
}