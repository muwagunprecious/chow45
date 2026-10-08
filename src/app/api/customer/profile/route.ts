import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { resolveSessionUser } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const authResult = await resolveSessionUser(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, authResult.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();

    // Try session auth first
    const authResult = await resolveSessionUser(request);
    let targetUserId = authResult ? authResult.userId : null;

    // Fallback: look up by email if provided
    if (!targetUserId && rawEmail) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${rawEmail}`)
        .limit(1);
      if (existing) {
        targetUserId = existing.id;
      }
    }

    if (!targetUserId && !rawEmail) {
      return NextResponse.json({ error: "User email or active session required" }, { status: 400 });
    }

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };
    if (name) updateFields.name = name;
    if (phone) updateFields.phone = phone;

    if (targetUserId) {
      await db.update(users).set(updateFields).where(eq(users.id, targetUserId));
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: targetUserId,
        name: name || undefined,
        phone: phone || undefined,
        address: address || undefined,
        email: rawEmail || undefined,
      },
    });
  } catch (error: any) {
    console.error("[customer profile update error]", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}
