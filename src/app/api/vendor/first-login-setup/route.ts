import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts } from "@/db/schema/users";
import { vendors } from "@/db/schema/vendors";
import { currentVendorUserId } from "@/lib/session";
import { hashPassword } from "better-auth/crypto";

export async function POST(request: Request) {
  try {
    let userId = await currentVendorUserId(request);
    const body = await request.json().catch(() => ({}));
    const newPassword = String(body.newPassword ?? "").trim();
    const address = String(body.address ?? "").trim();
    const latitude = body.latitude ? String(body.latitude) : null;
    const longitude = body.longitude ? String(body.longitude) : null;
    const email = String(body.email ?? "").toLowerCase().trim();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // Fallback: look up user by email if session cookie was not provided
    if (userId === null && email) {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${email}`)
        .limit(1);
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      }
    }

    // Resolve vendor row
    let vendorRow: typeof vendors.$inferSelect | null = null;
    if (userId !== null) {
      const v = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
      if (v[0]) vendorRow = v[0];
    }
    if (!vendorRow && email) {
      const v = await db.select().from(vendors).where(sql`LOWER(${vendors.contactEmail}) = ${email}`).limit(1);
      if (v[0]) {
        vendorRow = v[0];
        if (userId === null && vendorRow.userId) {
          userId = Number(vendorRow.userId);
        }
      }
    }

    if (userId === null) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in first." },
        { status: 401 }
      );
    }

    const finalAddress = address && address.length >= 2
      ? address
      : (vendorRow?.address || "OSUTH Campus, Sagamu");

    // 1. Hash the new password and update the accounts table
    const hashedPassword = await hashPassword(newPassword);

    const existingAcc = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);

    if (existingAcc.length > 0) {
      await db
        .update(accounts)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(accounts.userId, userId));
    } else {
      await db.insert(accounts).values({
        userId,
        accountId: String(userId),
        providerId: "credential",
        password: hashedPassword,
      });
    }

    // 2. Update vendor's pickup address and mark password changed
    if (vendorRow) {
      const existingTags = Array.isArray(vendorRow.tags) ? vendorRow.tags : [];
      const updatedTags = Array.from(
        new Set([
          ...existingTags.filter((t) => t !== "must_change_password"),
          "first_time_setup_done",
          "password_changed",
        ])
      );

      await db
        .update(vendors)
        .set({
          address: finalAddress,
          latitude: latitude || vendorRow.latitude,
          longitude: longitude || vendorRow.longitude,
          tags: updatedTags,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorRow.id));
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully!",
      address: finalAddress,
    });
  } catch (error: any) {
    console.error("[first-login-setup] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save initial setup." },
      { status: 500 }
    );
  }
}
