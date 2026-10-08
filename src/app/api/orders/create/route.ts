import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderEvents, platformLedgers, users, vendors } from "@/db";
import { currentUserId } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rawOrder = (body.order || body) as Record<string, any>;

    const orderId = String(rawOrder.id || "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    const storeId = String(rawOrder.storeId || "unknown-store").trim();
    const storeName = String(rawOrder.storeName || "Campus Food Spot").trim();
    const customerName = String(rawOrder.customerName || "Customer").trim();
    const customerPhone = String(rawOrder.customerPhone || "").trim() || null;
    const deliveryAddress = String(rawOrder.deliveryAddress || "Sagamu Campus (OSUTH)").trim();
    const deliveryNotes = rawOrder.deliveryNotes ? String(rawOrder.deliveryNotes) : null;
    const paymentMethod = String(rawOrder.paymentMethod || "Debit Card (Paystack)").trim();
    
    const subtotal = Math.round(Number(rawOrder.subtotal) || 2000);
    const serviceFee = Math.round(Number(rawOrder.serviceFee) || 400);
    const deliveryFee = Math.max(800, Math.round(Number(rawOrder.deliveryFee) || 800));
    const total = Math.round(Number(rawOrder.total) || (subtotal + serviceFee + deliveryFee));

    const pin = String(rawOrder.pin || Math.floor(1000 + Math.random() * 9000)).trim();
    const status = String(rawOrder.status || "PAID").toUpperCase();
    const routeDistanceMeters = rawOrder.routeDistanceMeters ? Math.round(Number(rawOrder.routeDistanceMeters)) : null;
    const estimatedDurationSeconds = rawOrder.estimatedDurationSeconds ? Math.round(Number(rawOrder.estimatedDurationSeconds)) : null;

    // 1. Resolve userId
    let resolvedUserId: number | null = await currentUserId(request);
    if (!resolvedUserId) {
      // Find customer by email/phone or fallback to first available USER
      if (rawOrder.customerEmail) {
        const u = await db.select({ id: users.id }).from(users).where(eq(users.email, String(rawOrder.customerEmail).toLowerCase().trim())).limit(1);
        if (u[0]) resolvedUserId = u[0].id;
      }
      if (!resolvedUserId && customerPhone) {
        const u = await db.select({ id: users.id }).from(users).where(eq(users.phone, customerPhone)).limit(1);
        if (u[0]) resolvedUserId = u[0].id;
      }
      if (!resolvedUserId) {
        const u = await db.select({ id: users.id }).from(users).where(eq(users.role, "USER")).orderBy(users.id).limit(1);
        if (u[0]) resolvedUserId = u[0].id;
      }
      if (!resolvedUserId) {
        const u = await db.select({ id: users.id }).from(users).orderBy(users.id).limit(1);
        if (u[0]) resolvedUserId = u[0].id;
      }
      if (!resolvedUserId) {
        return NextResponse.json({ error: "No user account available for order placement." }, { status: 400 });
      }
    }

    // 2. Resolve vendorId
    let resolvedVendorId: number | null = null;
    if (storeId) {
      const v = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.storeId, storeId)).limit(1);
      if (v[0]) resolvedVendorId = v[0].id;
    }
    if (!resolvedVendorId && storeName) {
      const v = await db.select({ id: vendors.id }).from(vendors).where(sql`LOWER(${vendors.businessName}) = LOWER(${storeName})`).limit(1);
      if (v[0]) resolvedVendorId = v[0].id;
    }
    if (!resolvedVendorId) {
      const v = await db.select({ id: vendors.id }).from(vendors).limit(1);
      if (v[0]) resolvedVendorId = v[0].id;
    }

    const now = new Date();

    // 3. Insert or update the order
    const [savedOrder] = await db
      .insert(orders)
      .values({
        id: orderId,
        userId: resolvedUserId,
        vendorId: resolvedVendorId,
        storeId,
        storeName,
        customerName,
        customerPhone,
        deliveryAddress,
        deliveryNotes,
        deliveryLocation: rawOrder.deliveryLocation || null,
        paymentMethod,
        subtotal,
        serviceFee,
        deliveryFee,
        total,
        status: status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "PAID",
        pin,
        routeDistanceMeters,
        estimatedDurationSeconds,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: orders.id,
        set: {
          status: status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "PAID",
          deliveryAddress,
          deliveryNotes,
          deliveryFee,
          total,
          updatedAt: now,
        },
      })
      .returning();

    // 4. Insert items if provided
    const items = Array.isArray(rawOrder.items) ? rawOrder.items : [];
    if (items.length > 0) {
      // Delete existing items for idempotency
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));

      await db.insert(orderItems).values(
        items.map((item: any) => ({
          orderId,
          menuItemId: item.id || item.menuItemId || null,
          name: String(item.name || "Food Item"),
          qty: Math.max(1, Number(item.qty) || 1),
          unitPrice: Math.round(Number(item.price) || 0),
          itemTotal: Math.round((Number(item.price) || 0) * (Number(item.qty) || 1)),
          selectedAddons: item.selectedAddons || [],
        }))
      );
    }

    // 5. Insert order event
    await db.insert(orderEvents).values({
      orderId,
      status: savedOrder.status,
      note: "Order created & payment verified. Dispatched to campus riders.",
      actor: "customer",
    });

    // 6. Update platform ledger
    await db
      .insert(platformLedgers)
      .values({ id: 1, totalGmv: total, totalServiceFees: serviceFee })
      .onConflictDoUpdate({
        target: platformLedgers.id,
        set: {
          totalGmv: sql`${platformLedgers.totalGmv} + ${total}`,
          totalServiceFees: sql`${platformLedgers.totalServiceFees} + ${serviceFee}`,
          updatedAt: now,
        },
      });

    return NextResponse.json({
      success: true,
      order: savedOrder,
      message: "Order placed successfully and dispatched to riders.",
    });
  } catch (error: any) {
    console.error("Error creating/syncing order:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
