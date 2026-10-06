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

    if (!address || address.length < 2) {
      return NextResponse.json(
        { error: "Please enter a valid pickup address." },
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

    if (userId === null) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in first." },
        { status: 401 }
      );
    }

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

    // 2. Update vendor's pickup address and mark first_time_setup_done
    const vendorRows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (vendorRows.length > 0) {
      const vnd = vendorRows[0];
      const existingTags = Array.isArray(vnd.tags) ? vnd.tags : [];
      const updatedTags = Array.from(new Set([...existingTags, "first_time_setup_done"]));

      await db
        .update(vendors)
        .set({
          address,
          latitude: latitude || vnd.latitude,
          longitude: longitude || vnd.longitude,
          tags: updatedTags,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vnd.id));
    }

    return NextResponse.json({
      success: true,
      message: "Password and store location updated successfully!",
      address,
    });
  } catch (error: any) {
    console.error("[first-login-setup] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save initial setup." },
      { status: 500 }
    );
  }
}
