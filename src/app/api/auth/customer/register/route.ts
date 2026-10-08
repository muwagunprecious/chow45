import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { userAuth } from "@/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body.email ?? "").trim();
    const password = String(body.password ?? "").trim() || "Chow45User!2026";
    const name = String(body.name ?? "").trim() || rawEmail.split("@")[0];
    const phone = String(body.phone ?? "").trim() || null;
    const address = String(body.address ?? "").trim() || null;

    if (!rawEmail || !rawEmail.includes("@") || !rawEmail.includes(".")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    let userId: number | null = null;

    // Check if user already exists
    const existing = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${email}`)
      .limit(1);

    if (existing.length > 0) {
      userId = existing[0].id;
      await db
        .update(users)
        .set({ emailVerified: true, phone, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      try {
        const signUpRes = await userAuth.api.signUpEmail({
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
            .set({ emailVerified: true, role: "USER", phone, updatedAt: new Date() })
            .where(eq(users.id, userId));
        }
      } catch (authErr: any) {
        console.warn("[customer register] Better Auth warning:", authErr?.message);
        const randSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        const username = (email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") + randSuffix).slice(0, 45);
        const refCode = ("RF" + randSuffix + Date.now().toString(36).slice(-4)).slice(0, 18).toUpperCase();
        const pubId = ("pub_" + randSuffix + Date.now().toString(36).slice(-4)).slice(0, 20);

        const [created] = await db
          .insert(users)
          .values({
            email,
            name,
            username,
            refCode,
            publicId: pubId,
            role: "USER",
            emailVerified: true,
            phone,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { emailVerified: true, phone, updatedAt: new Date() },
          })
          .returning();

        userId = created?.id ?? null;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Customer account ready!",
      user: {
        id: userId,
        email,
        name,
        role: "customer",
        phone,
        address,
      },
    });
  } catch (error: any) {
    console.error("[customer register] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
