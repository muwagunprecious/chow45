import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { vendors, vendorWallets } from "@/db";
import { vendorAuth } from "@/auth";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "store"
  );
}

async function uniqueStoreId(base: string): Promise<string> {
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? `rest-${base}` : `rest-${base}-${n + 1}`;
    const taken = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.storeId, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `rest-${base}-${Date.now().toString(36)}`;
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
  return `${base}-${Date.now().toString(36)}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body.email ?? "").trim();
    const password = String(body.password ?? "").trim() || "Chow45Vendor!2026";
    const storeName = String(body.storeName ?? body.businessName ?? "").trim();
    const phone = String(body.phone ?? body.ownerPhone ?? "").trim() || null;
    const address = String(body.address ?? "").trim() || null;
    const storeType = String(body.storeType ?? "physical").trim();
    const image = typeof body.image === "string" ? body.image : null;

    if (!rawEmail || !rawEmail.includes("@") || !rawEmail.includes(".")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!storeName || storeName.length < 2) {
      return NextResponse.json(
        { error: "A restaurant or business name is required." },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    let userId: number | null = null;

    // 1. Check if user already exists in users table
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${email}`)
      .limit(1);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      // Ensure user has VENDOR role and verified email
      await db
        .update(users)
        .set({ role: "VENDOR", emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      // Create user via Better Auth to ensure proper credentials and password hashing
      try {
        const signUpRes = await vendorAuth.api.signUpEmail({
          body: {
            email,
            password,
            name: storeName,
          },
        });

        if (signUpRes?.user?.id) {
          userId = Number(signUpRes.user.id);
          // Set role: VENDOR and emailVerified: true
          await db
            .update(users)
            .set({ role: "VENDOR", emailVerified: true, phone, updatedAt: new Date() })
            .where(eq(users.id, userId));
        }
      } catch (authErr: any) {
        console.warn("[vendor register] Better Auth signUp warning:", authErr?.message);
        // Fallback: direct insert if Better Auth threw because user existed in auth internals
        const randSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        const username = (email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") + randSuffix).slice(0, 45);
        const refCode = ("RF" + randSuffix + Date.now().toString(36).slice(-4)).slice(0, 18).toUpperCase();
        const pubId = ("pub_" + randSuffix + Date.now().toString(36).slice(-4)).slice(0, 20);

        const [createdUser] = await db
          .insert(users)
          .values({
            email,
            name: storeName,
            username,
            refCode,
            publicId: pubId,
            role: "VENDOR",
            emailVerified: true,
            phone,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { role: "VENDOR", emailVerified: true, phone, updatedAt: new Date() },
          })
          .returning();

        userId = createdUser?.id ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Could not create vendor account. Please try again." },
        { status: 500 }
      );
    }

    // 2. Check if vendor profile already exists for this email or userId
    const existingVendor = await db
      .select({ id: vendors.id, storeId: vendors.storeId })
      .from(vendors)
      .where(
        sql`LOWER(${vendors.contactEmail}) = ${email} OR ${vendors.userId} = ${userId}`
      )
      .limit(1);

    let vendorId: number;
    let storeId: string;

    if (existingVendor.length > 0) {
      vendorId = existingVendor[0].id;
      storeId = existingVendor[0].storeId;

      await db
        .update(vendors)
        .set({
          businessName: storeName,
          contactEmail: email,
          ownerPhone: phone,
          address: address || undefined,
          image: image || undefined,
          bannerImage: image || undefined,
          status: "approved",
          userId,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorId));
    } else {
      const baseSlug = slugify(storeName);
      storeId = await uniqueStoreId(baseSlug);
      const slug = await uniqueSlug(baseSlug);

      const [newVendor] = await db
        .insert(vendors)
        .values({
          storeId,
          slug,
          businessName: storeName,
          contactEmail: email,
          ownerPhone: phone,
          address,
          image,
          bannerImage: image,
          status: "approved",
          userId,
          source: "vendor",
          category: storeType === "physical" ? "Restaurant" : "Cloud Kitchen",
          tags: [storeType === "physical" ? "Restaurant" : "Cloud Kitchen", "Campus Delivery"],
        })
        .returning();

      vendorId = newVendor.id;

      // Create vendor wallet
      await db
        .insert(vendorWallets)
        .values({ vendorId })
        .onConflictDoNothing();
    }

    return NextResponse.json({
      success: true,
      message: "Vendor registered successfully!",
      user: {
        id: userId,
        email,
        name: storeName,
        role: "vendor",
        phone,
      },
      vendor: {
        id: vendorId,
        storeId,
        businessName: storeName,
        contactEmail: email,
        ownerPhone: phone,
        address,
      },
    });
  } catch (error: any) {
    console.error("[vendor register] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
