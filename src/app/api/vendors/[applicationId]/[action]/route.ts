import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { vendorApplications, vendors, vendorWallets } from "@/db";
import { currentRole, currentUserId } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import { serializeApplication } from "@/lib/serializers";

/**
 * Decides a vendor application.
 *
 *   POST /api/vendors/:applicationId/:action
 *     action = "approve" | "reject"
 *     body   = { reason? } (required for reject)
 *
 * This replaces `window.chowStore.approveVendor`, which only ever edited the
 * admin's own localStorage. The whole point of moving the application here is
 * that an approval now (a) writes the `vendors` row and wallet, and (b) is
 * visible to the applicant on their status poll — in the same transaction.
 */

type Ctx = RouteContext<"/api/vendors/[applicationId]/[action]">;

export async function POST(request: Request, ctx: Ctx) {
  const role = await currentRole(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { applicationId, action } = await ctx.params;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const reason = optionalText(body.reason, 500);

  try {
    const found = await db
      .select()
      .from(vendorApplications)
      .where(eq(vendorApplications.applicationId, applicationId))
      .limit(1);

    const application = found[0];
    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    if (application.status !== "pending") {
      return NextResponse.json(
        { error: `This application was already ${application.status}.` },
        { status: 409 },
      );
    }

    if (action === "reject" && !reason) {
      return NextResponse.json(
        { error: "A reason is required when declining an application." },
        { status: 400 },
      );
    }

    const now = new Date();
    const adminId = await currentUserId(request);

    // The decision and the storefront creation must move together, so the
    // applicant can never see "approved" without a working storefront, or a
    // published store whose application still says "pending".
    const decision = await db.transaction(async (tx) => {
      let vendorId: number | null = null;

      if (action === "approve") {
        const [vendor] = await tx
          .insert(vendors)
          .values({
            storeId: await uniqueStoreId(tx, safeSlug(application.businessName)),
            slug: await uniqueSlug(tx, safeSlug(application.businessName)),
            businessName: application.businessName,
            ownerName: application.ownerName,
            ownerPhone: application.ownerPhone,
            contactEmail: application.ownerEmail,
            address: application.address,
            cuisine: application.cuisine,
            openingTime: application.openingTime,
            closingTime: application.closingTime,
            latitude: application.pickupLat,
            longitude: application.pickupLng,
            bannerImage: application.coverImage,
            status: "approved",
            source: "application",
            userId: application.userId,
          })
          .returning();

        vendorId = vendor.id;
        await tx.insert(vendorWallets).values({ vendorId: vendor.id });
      }

      const [updated] = await tx
        .update(vendorApplications)
        .set({
          status: action,
          rejectionReason: action === "reject" ? reason : null,
          reviewedAt: now,
          reviewedBy: adminId,
          vendorId,
          updatedAt: now,
        })
        .where(eq(vendorApplications.applicationId, applicationId))
        .returning();

      return updated;
    });

    return NextResponse.json({ application: serializeApplication(decision) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function safeSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "store";
}

async function uniqueStoreId(tx: Tx, base: string): Promise<string> {
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.storeId, candidate)).limit(1);
    if (taken.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function uniqueSlug(tx: Tx, base: string): Promise<string> {
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, candidate)).limit(1);
    if (taken.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}