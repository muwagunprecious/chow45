import { NextResponse } from "next/server";
import { db } from "@/db";
import { vendors } from "@/db/schema/vendors";
import { eq } from "drizzle-orm";
import { vendorAuth } from "@/auth";

/**
 * The vendor profile is read and written by the signed-in vendor.
 *
 * The row is keyed on `vendors.userId`, which is unique, so POST doubles as an
 * upsert. `latitude`/`longitude` are filled in when the vendor shares their live
 * location; a manually typed address leaves them null.
 */
async function resolveUserId(request: Request): Promise<number | null> {
  const session = await vendorAuth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;

  // Better Auth carries the id as a string while the column is a bigserial.
  const userId = Number(session.user.id);
  return Number.isFinite(userId) ? userId : null;
}

function toCoord(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(6);
}

export async function GET(request: Request) {
  try {
    const userId = await resolveUserId(request);
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const found = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    return NextResponse.json({ vendor: found[0] ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const userId = await resolveUserId(request);
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));

    const businessName = (body.businessName || "").toString().trim();
    if (businessName.length < 2) {
      return NextResponse.json({ error: "businessName is required" }, { status: 400 });
    }

    const address = body.address ? body.address.toString().trim() : null;
    const image = body.image ? body.image.toString().trim() : null;
    const latitude = toCoord(body.latitude);
    const longitude = toCoord(body.longitude);

    const patch = { businessName, address, image, latitude, longitude, updatedAt: new Date() };

    const existing = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (existing[0]) {
      const [updated] = await db
        .update(vendors)
        .set(patch)
        .where(eq(vendors.userId, userId))
        .returning();
      return NextResponse.json({ vendor: updated });
    }

    const [created] = await db
      .insert(vendors)
      .values({ ...patch, userId, status: "pending" })
      .returning();

    return NextResponse.json({ vendor: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

