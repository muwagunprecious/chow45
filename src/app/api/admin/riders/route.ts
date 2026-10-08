import { NextResponse } from "next/server";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { riders } from "@/db/schema/riders";
import { users } from "@/db/schema/users";
import { riderWallets } from "@/db/schema/rider-finance";
import { requireAdmin } from "@/lib/session";

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q");

  const conditions = [];

  if (status && status !== "ALL") {
    conditions.push(
      or(
        eq(riders.applicationStatus, status),
        eq(riders.approvalStatus, status)
      )
    );
  }

  if (query) {
    conditions.push(
      or(
        ilike(riders.name, `%${query}%`),
        ilike(riders.phone, `%${query}%`),
        ilike(riders.identityNumber, `%${query}%`),
        ilike(riders.institution, `%${query}%`)
      )
    );
  }

  const riderList = await db
    .select({
      id: riders.id,
      name: riders.name,
      phone: riders.phone,
      vehicle: riders.vehicle,
      avatar: riders.avatar,
      location: riders.location,
      identityMethod: riders.identityMethod,
      identityNumber: riders.identityNumber,
      institution: riders.institution,
      applicationStatus: riders.applicationStatus,
      approvalStatus: riders.approvalStatus,
      rejectionReason: riders.rejectionReason,
      suspensionReason: riders.suspensionReason,
      isOnline: riders.isOnline,
      isAvailable: riders.isAvailable,
      rating: riders.rating,
      tripsCount: riders.tripsCount,
      approvedAt: riders.approvedAt,
      suspendedAt: riders.suspendedAt,
      createdAt: riders.createdAt,
      userId: riders.userId,
      walletAvailable: riderWallets.available,
      walletTotalEarned: riderWallets.totalEarned,
      walletProcessing: riderWallets.processing,
    })
    .from(riders)
    .leftJoin(riderWallets, eq(riderWallets.riderId, riders.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(riders.createdAt));

  return NextResponse.json({ riders: riderList });
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const body = await request.json().catch(() => ({}));
  const riderId = String(body.riderId ?? "").trim();
  const action = String(body.action ?? "").trim().toUpperCase(); // APPROVE | REJECT | SUSPEND | REACTIVATE
  const reason = String(body.reason ?? "").trim();

  if (!riderId) {
    return NextResponse.json({ error: "riderId is required" }, { status: 400 });
  }

  const existingRider = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
  if (existingRider.length === 0) {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }

  const now = new Date();
  const adminUserId = adminCheck.userId;

  let patch: Record<string, unknown> = {
    updatedAt: now,
    reviewedBy: adminUserId,
    reviewedAt: now,
  };

  if (action === "APPROVE") {
    patch.applicationStatus = "APPROVED";
    patch.approvalStatus = "APPROVED";
    patch.approvedAt = now;
    patch.rejectionReason = null;
    patch.suspensionReason = null;
  } else if (action === "REJECT") {
    patch.applicationStatus = "REJECTED";
    patch.approvalStatus = "REJECTED";
    patch.rejectionReason = reason || "Application did not meet verification criteria.";
    patch.isOnline = false;
    patch.isAvailable = false;
  } else if (action === "SUSPEND") {
    patch.applicationStatus = "SUSPENDED";
    patch.approvalStatus = "SUSPENDED";
    patch.suspensionReason = reason || "Account suspended by Chow45 operations.";
    patch.suspendedAt = now;
    patch.isOnline = false;
    patch.isAvailable = false;
  } else if (action === "REACTIVATE") {
    patch.applicationStatus = "APPROVED";
    patch.approvalStatus = "APPROVED";
    patch.suspensionReason = null;
  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const [updated] = await db
    .update(riders)
    .set(patch as never)
    .where(eq(riders.id, riderId))
    .returning();

  return NextResponse.json({
    success: true,
    message: `Rider ${updated.name} has been ${action.toLowerCase()}d.`,
    rider: updated,
  });
}
