import { NextResponse } from "next/server";
import { db } from "@/db";
import { deliveryConfigs, serviceZones } from "@/db";
import { toCoord } from "@/lib/validation";

/**
 * Authoritative delivery estimate.
 *
 *   POST /api/delivery/quote
 *     { pickup: { lat, lng }, dropoff: { lat, lng }, zoneId? }
 *
 * The browser's Mapbox quote is a hint, not a source of truth: it is priced
 * from the stored config here, on the server, so the number shown at checkout
 * is the same number the order route will charge. The distance itself is the
 * great-circle length — good enough for a fee that is mostly meant to cover
 * fuel, and it has the bonus that a tampered Mapbox payload cannot alter it.
 *
 * Returns the shape `mapbox-service.js` already reads:
 *   { distanceMeters, durationSeconds, deliveryFee, serviceFee, inZone }
 */

/** Distance in meters between two lat/lng points (haversine). */
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

type LngLat = [number, number];

/** Ray-cast point-in-polygon; polygon rings are `[lng, lat]` pairs. */
function inPolygon(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pickupRaw = (body.pickup ?? body.origin ?? {}) as Record<string, unknown>;
  const dropoffRaw = (body.dropoff ?? body.destination ?? {}) as Record<string, unknown>;

  const pickup = {
    lat: Number(toLat2(pickupRaw.lat ?? pickupRaw.latitude) ?? pickupRaw.lat),
    lng: Number(toLng2(pickupRaw.lng ?? pickupRaw.longitude) ?? pickupRaw.lng),
  };
  const dropoff = {
    lat: Number(toLat2(dropoffRaw.lat ?? dropoffRaw.latitude) ?? dropoffRaw.lat),
    lng: Number(toLng2(dropoffRaw.lng ?? dropoffRaw.longitude) ?? dropoffRaw.lng),
  };

  if (![pickup.lat, pickup.lng, dropoff.lat, dropoff.lng].every(Number.isFinite)) {
    return NextResponse.json(
      { error: "Pickup and dropoff coordinates are required." },
      { status: 400 },
    );
  }

  try {
    const [configRows, zones] = await Promise.all([
      db.select().from(deliveryConfigs).limit(1),
      db.select().from(serviceZones),
    ]);

    const config = configRows[0];

    // Prefer the zone the client already resolved; fall back to whichever
    // active zone contains the dropoff.
    const requestedZone = String(body.zoneId ?? "");
    const zone =
      zones.find((z) => z.isActive && z.id === requestedZone) ??
      zones.find((z) => z.isActive && inPolygon(dropoff.lng, dropoff.lat, z.polygon)) ??
      zones.find((z) => z.isActive && !z.polygon.length) ??
      null;

    const distance = haversineMeters(pickup, dropoff);
    // Rough city riding speed, matching the client's 500 m/s fallback estimate
    // in spirit without pretending to be a routing engine.
    const durationSeconds = Math.round((distance / 500) * 60);

    const base = config?.baseFee ?? 300;
    const rate = config?.ratePerMeter ?? 200;
    const min = config?.minDeliveryFee ?? 300;

    // A dropoff outside every active zone still gets a quote, but is flagged so
    // the checkout can warn instead of silently setting expectations.
    const inZone = zone !== null;
    const deliveryFee = Math.max(min, Math.round(base + distance * rate));

    return NextResponse.json({
      distanceMeters: distance,
      durationSeconds,
      deliveryFee,
      serviceFee: config?.serviceFee ?? 400,
      inZone,
      zoneId: zone?.id ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

function toLat2(value: unknown): string | null {
  const coord = toCoord(value);
  if (coord === null) return null;
  const n = Number(coord);
  return n >= -90 && n <= 90 ? coord : null;
}

function toLng2(value: unknown): string | null {
  return toCoord(value);
}