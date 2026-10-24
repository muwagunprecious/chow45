import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryConfigs, serviceZones, vendors } from "@/db";
import {
  getDistanceMeters,
  calculateDeliveryFee,
  validateCoordinates,
  formatDistanceLabel,
  DELIVERY_PRICING_CONFIG,
} from "@/lib/delivery-pricing";

/**
 * Authoritative delivery estimate based on vendor & customer GPS coordinates.
 *
 *   POST /api/delivery/quote
 *     { storeId?, vendorId?, pickup?: { lat, lng }, dropoff: { lat, lng }, zoneId? }
 *
 * Computes great-circle straight-line distance using the Haversine formula
 * and determines delivery fees using the authoritative Chow45 policy:
 *   deliveryFee = max(200, ceil((distanceMeters / 1000) * 200))
 */

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

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : null;
  const vendorId = typeof body.vendorId === "number" ? body.vendorId : (body.vendorId ? Number(body.vendorId) : null);

  let pickupCoords: { lat: number; lng: number } | null = null;

  // 1. Authoritative vendor coordinates lookup from DB if storeId or vendorId is provided
  if (storeId || vendorId) {
    const condition = storeId
      ? eq(vendors.storeId, storeId)
      : eq(vendors.id, vendorId!);
    const vendorRows = await db
      .select({
        id: vendors.id,
        storeId: vendors.storeId,
        latitude: vendors.latitude,
        longitude: vendors.longitude,
      })
      .from(vendors)
      .where(condition)
      .limit(1);

    const vendor = vendorRows[0];
    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found." },
        { status: 404 }
      );
    }

    if (vendor.latitude === null || vendor.longitude === null) {
      return NextResponse.json(
        { error: "Vendor location coordinates are not configured. Please contact the vendor or select another store." },
        { status: 400 }
      );
    }

    pickupCoords = validateCoordinates(vendor.latitude, vendor.longitude);
    if (!pickupCoords) {
      return NextResponse.json(
        { error: "Vendor location coordinates are invalid. Please contact the vendor." },
        { status: 400 }
      );
    }
  }

  // Fallback to explicit pickup coordinates if not resolved from DB
  if (!pickupCoords) {
    const pickupRaw = (body.pickup ?? body.origin ?? {}) as Record<string, unknown>;
    pickupCoords = validateCoordinates(
      pickupRaw.lat ?? pickupRaw.latitude,
      pickupRaw.lng ?? pickupRaw.longitude
    );
  }

  if (!pickupCoords) {
    return NextResponse.json(
      { error: "Valid pickup coordinates or vendor storeId are required." },
      { status: 400 }
    );
  }

  // 2. Validate customer dropoff coordinates
  const dropoffRaw = (body.dropoff ?? body.destination ?? {}) as Record<string, unknown>;
  const dropoffCoords = validateCoordinates(
    dropoffRaw.lat ?? dropoffRaw.latitude,
    dropoffRaw.lng ?? dropoffRaw.longitude
  );

  if (!dropoffCoords) {
    return NextResponse.json(
      { error: "Valid delivery coordinates are required. Please select a delivery location." },
      { status: 400 }
    );
  }

  try {
    const [configRows, zones] = await Promise.all([
      db.select().from(deliveryConfigs).limit(1),
      db.select().from(serviceZones),
    ]);

    const config = configRows[0];

    // Prefer the zone the client already resolved; fall back to polygon check
    const requestedZone = String(body.zoneId ?? "");
    const zone =
      zones.find((z) => z.isActive && z.id === requestedZone) ??
      zones.find((z) => z.isActive && inPolygon(dropoffCoords.lng, dropoffCoords.lat, z.polygon)) ??
      zones.find((z) => z.isActive && !z.polygon.length) ??
      null;

    const distanceMeters = getDistanceMeters(
      pickupCoords.lat,
      pickupCoords.lng,
      dropoffCoords.lat,
      dropoffCoords.lng
    );

    const ratePerKm = config?.ratePerMeter
      ? Math.round(Number(config.ratePerMeter) * 1000)
      : DELIVERY_PRICING_CONFIG.RATE_PER_KM;
    const minFee = config?.minDeliveryFee ?? DELIVERY_PRICING_CONFIG.MINIMUM_DELIVERY_FEE;
    const serviceFee = config?.serviceFee ?? DELIVERY_PRICING_CONFIG.SERVICE_FEE;

    const deliveryFee = calculateDeliveryFee(distanceMeters, ratePerKm, minFee);
    const durationSeconds = Math.round((distanceMeters / 500) * 60);
    const inZone = zone !== null;

    return NextResponse.json({
      distanceMeters: Math.round(distanceMeters),
      distanceLabel: formatDistanceLabel(distanceMeters),
      durationSeconds,
      deliveryFee,
      deliveryFeeLabel: `₦${deliveryFee.toLocaleString()}`,
      serviceFee,
      ratePerKm,
      minDeliveryFee: minFee,
      inZone,
      zoneId: zone?.id ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
