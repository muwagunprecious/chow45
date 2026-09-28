import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { vendorApplications } from "@/db";
import { currentVendorUserId } from "@/lib/session";
import { optionalText, readClientId, toCoord, toLat } from "@/lib/validation";
import { serializeApplication } from "@/lib/serializers";

/**
 * Starts a vendor application.
 *
 *   POST /api/vendors/apply
 *
 * This used to be `state.vendorOnboarding` — a localStorage object the
 * applicant edited freely. It is now a row in `vendor_applications` with its
 * own `applicationId` handle, which the applicant polls on the status route
 * until an admin reviews it. The handle is the only thing the client keeps.
 */

/** A short, memorable handle typed back into the status check. */
async function nextApplicationId(): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = `APL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const taken = await db
      .select({ id: vendorApplications.id })
      .from(vendorApplications)
      .where(eq(vendorApplications.applicationId, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `APL-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
  const userId = await currentVendorUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to apply as a vendor." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Create a copy with the app's own id so the business keeps its existing
  // handle when the form is re-submitted after a validation error.
  const idProvider = readClientId(body.id);
  const existing = idProvider
    ? (
        await db
          .select()
          .from(vendorApplications)
          .where(eq(vendorApplications.id, idProvider))
          .limit(1)
      )[0]
    : null;

  const businessName = optionalText(body.businessName, 255);
  if (!businessName) {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  }

  try {
    const values = {
      userId,
      businessName,
      ownerName: optionalText(body.ownerName, 255),
      ownerEmail: optionalText(body.ownerEmail, 255),
      ownerPhone: optionalText(body.ownerPhone, 20),
      address: optionalText(body.address, 500),
      lga: optionalText(body.lga, 100),
      pickupLat: toLat(body.pickupLat ?? body.latitude),
      pickupLng: toCoord(body.pickupLng ?? body.longitude),
      cuisine: optionalText(body.cuisine, 100),
      openingTime: optionalText(body.openingTime, 50),
      closingTime: optionalText(body.closingTime, 50),
      coverImage: optionalText(body.coverImage ?? body.coverImg, 1000),
      status: "pending",
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db
        .update(vendorApplications)
        .set(values)
        .where(eq(vendorApplications.id, existing.id))
        .returning();
      return NextResponse.json({ application: serializeApplication(updated) });
    }

    const [created] = await db
      .insert(vendorApplications)
      .values({
        ...values,
        id: idProvider ?? `apl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        applicationId: await nextApplicationId(),
      })
      .returning();

    return NextResponse.json({ application: serializeApplication(created) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}