import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { vendors, vendorWallets, users } from "@/db";
import { requireVendor } from "@/lib/session";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

/**
 * The vendor profile is read and written by the signed-in vendor.
 *
 * The row is keyed on `vendors.userId`, which is unique, so POST doubles as an
 * upsert. `latitude`/`longitude` are filled in when the vendor shares their live
 * location; a manually typed address leaves them null.
 */

function toCoord(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(6);
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "store";
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get("storeId");
    const vendorId = url.searchParams.get("vendorId");
    const email = url.searchParams.get("email");

    const authResult = await requireVendor(request, {
      storeId: storeId || undefined,
      vendorId: vendorId || undefined,
      email: email || undefined,
    });

    if (!authResult.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendor = authResult.vendor;
    const userEmail = (authResult.user?.email || vendor?.contactEmail || "").toLowerCase();
    const isTargetUser = userEmail === "tolaniakin2022@gmail.com";
    const hasDoneSetup = vendor?.tags?.includes("first_time_setup_done") ?? false;
    const requiresFirstTimeSetup = isTargetUser && !hasDoneSetup;

    return NextResponse.json({
      vendor,
      requiresFirstTimeSetup,
      userEmail,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const authResult = await requireVendor(request, {
      storeId: body.storeId,
      vendorId: body.vendorId,
      email: body.contactEmail || body.email,
    });

    if (!authResult.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authResult.userId;
    const currentVendor = authResult.vendor;

    const businessName = String(body.businessName ?? currentVendor?.businessName ?? "").trim();
    if (businessName.length < 2) {
      return NextResponse.json({ error: "businessName is required" }, { status: 400 });
    }

    // Contact email is validated server-side.
    const rawEmail = String(body.contactEmail ?? "").trim();
    if (rawEmail.length > 0 && !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }
    const contactEmail = rawEmail.length > 0 ? normalizeEmail(rawEmail) : (currentVendor?.contactEmail ?? null);

    const address = text(body.address);
    const image = text(body.image);
    const latitude = toCoord(body.latitude);
    const longitude = toCoord(body.longitude);

    const patch = {
      businessName,
      slug: slugify(businessName),
      address,
      image,
      latitude,
      longitude,
      contactEmail,
      cuisine: text(body.cuisine),
      ownerName: text(body.ownerName),
      ownerPhone: text(body.ownerPhone),
      openingTime: text(body.openingTime),
      closingTime: text(body.closingTime),
      bannerImage: text(body.bannerImage) ?? image,
      updatedAt: new Date(),
    };

    if (currentVendor?.id) {
      const [updated] = await db
        .update(vendors)
        .set(patch)
        .where(eq(vendors.id, currentVendor.id))
        .returning();
      return NextResponse.json({ vendor: updated });
    }

    // A new storefront needs a public id. It is derived from the business name
    // and de-duplicated, because `vendors.store_id` is unique and two vendors
    // can easily pick the same trading name.
    const storeId = await uniqueStoreId(slugify(businessName));
    const slug = await uniqueSlug(slugify(businessName));

    const [created] = await db
      .insert(vendors)
      .values({ ...patch, storeId, slug, userId, status: "pending", source: "vendor" })
      .returning();

    // A vendor with no wallet row reads as a zero balance rather than as an
    // error, so the row is created alongside the storefront.
    await db.insert(vendorWallets).values({ vendorId: created.id });

    return NextResponse.json({ vendor: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/** Appends a numeric suffix until the id is free. */
async function uniqueStoreId(base: string): Promise<string> {
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.storeId, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function uniqueSlug(base: string): Promise<string> {
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.slug, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}
