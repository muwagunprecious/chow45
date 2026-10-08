import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { users, accounts } from "@/db/schema/users";
import { riders } from "@/db/schema/riders";
import { riderWallets } from "@/db/schema/rider-finance";
import { riderAuth } from "@/auth";
import { hashPassword } from "better-auth/crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body.email ?? "").trim();
    const password = String(body.password ?? "").trim() || "Chow45Rider!2026";
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim() || null;
    const vehicle = String(body.vehicle ?? "Bicycle").trim();
    const identityMethod = String(body.identityMethod ?? "NIN").trim().toUpperCase(); // "NIN" | "MATRIC"
    const identityNumber = String(body.identityNumber ?? "").trim();
    const institution = String(body.institution ?? "").trim() || null;
    const avatar = typeof body.avatar === "string" ? body.avatar : null;
    const location = String(body.location ?? "University Campus").trim();

    if (!rawEmail || !rawEmail.includes("@") || !rawEmail.includes(".")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Full legal name is required." },
        { status: 400 }
      );
    }

    if (!identityNumber) {
      return NextResponse.json(
        { error: `Your ${identityMethod === "MATRIC" ? "Matriculation Number" : "NIN"} is required for background verification.` },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    let userId: number | null = null;

    // 1. Check if user already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${email}`)
      .limit(1);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      await db
        .update(users)
        .set({ role: "RIDER", emailVerified: true, phone, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      try {
        const signUpRes = await riderAuth.api.signUpEmail({
          body: {
            email,
            password,
            name,
          },
        });

        if (signUpRes?.user?.id) {
          userId = Number(signUpRes.user.id);
          await db
            .update(users)
            .set({ role: "RIDER", emailVerified: true, phone, updatedAt: new Date() })
            .where(eq(users.id, userId));
        }
      } catch (authErr: any) {
        console.warn("[rider register] Better Auth signUp fallback:", authErr?.message);
        const randSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        const username = (email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") + randSuffix).slice(0, 45);
        const refCode = ("RD" + randSuffix + Date.now().toString(36).slice(-4)).slice(0, 18).toUpperCase();
        const pubId = ("pub_rd_" + randSuffix + Date.now().toString(36).slice(-4)).slice(0, 20);

        const [createdUser] = await db
          .insert(users)
          .values({
            email,
            name,
            username,
            refCode,
            publicId: pubId,
            role: "RIDER",
            emailVerified: true,
            phone,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { role: "RIDER", emailVerified: true, phone, updatedAt: new Date() },
          })
          .returning();

        userId = createdUser?.id ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Could not create rider account credentials." },
        { status: 500 }
      );
    }

    // Ensure account credentials exist
    try {
      const existingAccount = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .limit(1);

      if (existingAccount.length === 0) {
        const hashedPassword = await hashPassword(password);
        await db.insert(accounts).values({
          userId,
          accountId: String(userId),
          providerId: "credential",
          password: hashedPassword,
        });
      }
    } catch (accErr) {
      console.warn("[rider register] Error ensuring account credentials:", accErr);
    }

    // 2. Create or update rider profile
    const existingRider = await db
      .select({ id: riders.id })
      .from(riders)
      .where(eq(riders.userId, userId))
      .limit(1);

    let riderId: string;

    if (existingRider.length > 0) {
      riderId = existingRider[0].id;
      await db
        .update(riders)
        .set({
          name,
          phone,
          vehicle,
          avatar: avatar || undefined,
          identityMethod,
          identityNumber,
          institution,
          location,
          applicationStatus: "PENDING_REVIEW",
          approvalStatus: "PENDING",
          updatedAt: new Date(),
        })
        .where(eq(riders.id, riderId));
    } else {
      riderId = `rider-${nanoid(10)}`;
      await db.insert(riders).values({
        id: riderId,
        userId,
        name,
        phone,
        vehicle,
        avatar,
        location,
        identityMethod,
        identityNumber,
        institution,
        applicationStatus: "PENDING_REVIEW",
        approvalStatus: "PENDING",
        isOnline: false,
        isAvailable: false,
      });
    }

    // 3. Ensure rider wallet exists
    const existingWallet = await db
      .select({ id: riderWallets.id })
      .from(riderWallets)
      .where(eq(riderWallets.riderId, riderId))
      .limit(1);

    if (existingWallet.length === 0) {
      await db.insert(riderWallets).values({
        id: `wallet-${riderId}`,
        riderId,
        available: 0,
        processing: 0,
        totalEarned: 0,
        currency: "NGN",
      });
    }

    return NextResponse.json({
      success: true,
      riderId,
      email,
      name,
      applicationStatus: "PENDING_REVIEW",
      message: "Application submitted successfully! Your account is under review by Chow45 operations.",
    });
  } catch (error: any) {
    console.error("[rider register error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to register rider profile." },
      { status: 500 }
    );
  }
}
