import { NextResponse } from "next/server";
import { eq, desc, sql, and, or, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { riders } from "@/db/schema/riders";
import { users } from "@/db/schema/users";
import { orders, orderItems } from "@/db/schema/orders";
import { riderWallets } from "@/db/schema/rider-finance";
import { requireAdmin } from "@/lib/session";

/**
 * Check if the request is from an authenticated admin.
 * Accepts session auth, master admin key ("admin2026"), or admin auth cookie.
 */
async function checkAdminAuth(request: Request): Promise<{ ok: boolean; userId?: number; error?: string; status?: number }> {
  const adminKey = request.headers.get("x-admin-key") || request.headers.get("x-admin-secret");
  const cookieHeader = request.headers.get("cookie") || "";
  const hasAdminCookie = cookieHeader.includes("chow45_admin_auth=true");
  
  let queryAdminKey: string | null = null;
  try {
    const url = new URL(request.url);
    queryAdminKey = url.searchParams.get("adminKey");
  } catch {}

  if (adminKey === "admin2026" || queryAdminKey === "admin2026" || hasAdminCookie) {
    return { ok: true, userId: 1 };
  }

  const sessionCheck = await requireAdmin(request);
  if (sessionCheck.ok) {
    return { ok: true, userId: sessionCheck.userId };
  }

  return { ok: false, error: sessionCheck.error, status: sessionCheck.status };
}

export async function GET(request: Request) {
  const auth = await checkAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error || "UNAUTHORIZED" }, { status: auth.status || 401 });
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

  // 1. Fetch all riders joined with user email and financial wallet
  const riderList = await db
    .select({
      id: riders.id,
      name: riders.name,
      phone: riders.phone,
      email: users.email,
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
    .leftJoin(users, eq(users.id, riders.userId))
    .leftJoin(riderWallets, eq(riderWallets.riderId, riders.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(riders.createdAt));

  // 2. Fetch packages (orders) including the verification code (PIN)
  const packageRows = await db
    .select({
      id: orders.id,
      pin: orders.pin, // The 4-digit code to be given to the rider
      status: orders.status,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryAddress: orders.deliveryAddress,
      deliveryNotes: orders.deliveryNotes,
      deliveryLocation: orders.deliveryLocation,
      storeName: orders.storeName,
      storeId: orders.storeId,
      subtotal: orders.subtotal,
      serviceFee: orders.serviceFee,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      riderId: orders.riderId,
      riderName: orders.riderName,
      isFoodReady: orders.isFoodReady,
      foodReadyAt: orders.foodReadyAt,
      isPreorder: orders.isPreorder,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(100);

  // 3. Fetch items for these packages
  const packageIds = packageRows.map((p) => p.id);
  const itemsByOrder = new Map<string, Array<{ name: string; qty: number; unitPrice: number; itemTotal: number }>>();

  if (packageIds.length > 0) {
    try {
      const itemRows = await db
        .select({
          orderId: orderItems.orderId,
          name: orderItems.name,
          qty: orderItems.qty,
          unitPrice: orderItems.unitPrice,
          itemTotal: orderItems.itemTotal,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, packageIds));

      for (const item of itemRows) {
        if (!itemsByOrder.has(item.orderId)) {
          itemsByOrder.set(item.orderId, []);
        }
        itemsByOrder.get(item.orderId)!.push(item);
      }
    } catch (err) {
      console.warn("Non-fatal: could not load package items:", err);
    }
  }

  // 4. Enrich packages with items and rider contact
  const riderPhoneMap = new Map<string, string>();
  riderList.forEach((r) => {
    if (r.phone) riderPhoneMap.set(r.id, r.phone);
  });

  const enrichedPackages = packageRows.map((pkg) => ({
    ...pkg,
    riderPhone: pkg.riderId ? riderPhoneMap.get(pkg.riderId) || null : null,
    items: itemsByOrder.get(pkg.id) || [],
  }));

  // 5. Aggregate active packages for each rider
  const ridersWithActiveMissions = riderList.map((rider) => {
    const activeOrders = enrichedPackages.filter(
      (p) => p.riderId === rider.id && !["DELIVERED", "CANCELLED", "REJECTED"].includes(p.status)
    );
    return {
      ...rider,
      activeOrdersCount: activeOrders.length,
      activeOrders: activeOrders.map((o) => ({
        id: o.id,
        pin: o.pin,
        status: o.status,
        storeName: o.storeName,
        customerName: o.customerName,
        deliveryFee: o.deliveryFee,
        total: o.total,
      })),
    };
  });

  return NextResponse.json({
    success: true,
    riders: ridersWithActiveMissions,
    packages: enrichedPackages,
    stats: {
      totalRiders: riderList.length,
      onlineRiders: riderList.filter((r) => r.isOnline).length,
      approvedRiders: riderList.filter((r) => r.approvalStatus === "APPROVED").length,
      pendingRiders: riderList.filter((r) => r.approvalStatus === "PENDING_REVIEW").length,
      suspendedRiders: riderList.filter((r) => r.approvalStatus === "SUSPENDED").length,
      activePackages: enrichedPackages.filter((p) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(p.status)).length,
      deliveredPackages: enrichedPackages.filter((p) => p.status === "DELIVERED").length,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await checkAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error || "UNAUTHORIZED" }, { status: auth.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").trim().toUpperCase(); // APPROVE | REJECT | SUSPEND | REACTIVATE | ASSIGN_ORDER | UNASSIGN_ORDER
  const riderId = String(body.riderId ?? "").trim();
  const orderId = String(body.orderId ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  const now = new Date();

  // Handle Order Assignment Actions
  if (action === "ASSIGN_ORDER") {
    if (!orderId || !riderId) {
      return NextResponse.json({ error: "orderId and riderId are required" }, { status: 400 });
    }
    const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    if (!rider) return NextResponse.json({ error: "Rider not found" }, { status: 404 });

    await db
      .update(orders)
      .set({
        riderId: rider.id,
        riderName: rider.name,
        status: "RIDER_ASSIGNED",
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({
      success: true,
      message: `Package #${orderId} assigned to rider ${rider.name}.`,
    });
  }

  if (action === "UNASSIGN_ORDER") {
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }
    await db
      .update(orders)
      .set({
        riderId: null,
        riderName: null,
        status: "READY_FOR_PICKUP",
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({
      success: true,
      message: `Package #${orderId} unassigned from rider and returned to dispatch queue.`,
    });
  }

  // Handle Rider Status Actions
  if (!riderId) {
    return NextResponse.json({ error: "riderId is required" }, { status: 400 });
  }

  const existingRider = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
  if (existingRider.length === 0) {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }

  let patch: Record<string, unknown> = {
    updatedAt: now,
    reviewedBy: auth.userId ?? 1,
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
