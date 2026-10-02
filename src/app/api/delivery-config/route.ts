import { NextResponse } from "next/server";

import { db } from "@/db";
import { deliveryConfigs } from "@/db";
import { currentRole } from "@/lib/session";
import { clampInt } from "@/lib/validation";

const SERVICE_FEE_MAX = 5000;
const BASE_FEE_MAX = 5000;
const MIN_FEE_MAX = 5000;

/**
 * The platform's fee rules.
 *
 *   GET /api/delivery-config   -> the stored config
 *   PUT /api/delivery-config   -> any admin replaces the whole config
 *
 * The config decides how much every order costs, so it is admin-only on write
 * and read by everyone through `/api/bootstrap`. Money that was previously
 * hard-coded in `data.js` is now a row the admin can change without a deploy —
 * and the order route reads the same row, so the two can never disagree.
 */

export async function GET() {
  const [config] = await db.select().from(deliveryConfigs).limit(1);

  if (!config) {
    // The seed inserts the row, but a fresh checkout that skipped seeding should
    // still return the documented defaults rather than a 404.
    return NextResponse.json({ config: { baseFee: 300, serviceFee: 400, ratePerMeter: 200, minDeliveryFee: 300 } });
  }

  return NextResponse.json({
    config: {
      baseFee: config.baseFee,
      serviceFee: config.serviceFee,
      ratePerMeter: config.ratePerMeter,
      minDeliveryFee: config.minDeliveryFee,
    },
  });
}

export async function PUT(request: Request) {
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

  // The rate is a fraction of a naira per meter and rounds to a sane range.
  const rawRate = Number(body.ratePerMeter);
  const ratePerMeter = Number.isFinite(rawRate) ? Math.min(5000, Math.max(0, rawRate)) : 200;

  const config = {
    baseFee: clampInt(body.baseFee, 0, BASE_FEE_MAX, 300),
    serviceFee: clampInt(body.serviceFee, 0, SERVICE_FEE_MAX, 400),
    ratePerMeter,
    minDeliveryFee: clampInt(body.minDeliveryFee, 0, MIN_FEE_MAX, 300),
    updatedAt: new Date(),
  };

  try {
    const [updated] = await db
      .insert(deliveryConfigs)
      .values({ id: 1, ...config })
      .onConflictDoUpdate({
        target: deliveryConfigs.id,
        set: { ...config },
      })
      .returning();

    return NextResponse.json({
      config: {
        baseFee: updated.baseFee,
        serviceFee: updated.serviceFee,
        ratePerMeter: updated.ratePerMeter,
        minDeliveryFee: updated.minDeliveryFee,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}