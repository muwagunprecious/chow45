import { NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderEvents } from "@/db/schema/orders";
import { vendors } from "@/db/schema/vendors";
import { requireVendor } from "@/lib/session";

const ALLOWED_VENDOR_STATUSES = [
  "RESTAURANT_ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "REJECTED",
  "CANCELLED",
] as const;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const orderId = String(body.orderId || body.id || "").trim();
    const newStatus = String(body.status || "").trim().toUpperCase();
    const note = body.note ? String(body.note).trim() : null;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    if (!ALLOWED_VENDOR_STATUSES.includes(newStatus as any)) {
      return NextResponse.json(
        {
          error: `Invalid vendor status '${newStatus}'. Allowed: ${ALLOWED_VENDOR_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const storeIdParam = typeof body.storeId === "string" ? body.storeId : undefined;
    const vendorIdParam = body.vendorId ? String(body.vendorId) : undefined;
    const emailParam = typeof body.email === "string" ? body.email : undefined;

    const auth = await requireVendor(request, {
      storeId: storeIdParam,
      vendorId: vendorIdParam,
      email: emailParam,
    });

    let vendor = auth.ok ? auth.vendor : null;

    // Fallback: If session not authenticated, check query or body params
    if (!vendor) {
      if (storeIdParam) {
        const rows = await db
          .select()
          .from(vendors)
          .where(eq(vendors.storeId, storeIdParam))
          .limit(1);
        if (rows[0]) vendor = rows[0];
      } else if (vendorIdParam && Number.isFinite(Number(vendorIdParam))) {
        const rows = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, Number(vendorIdParam)))
          .limit(1);
        if (rows[0]) vendor = rows[0];
      }
    }

    // Fetch the target order
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const targetOrder = orderRows[0];

    // If vendor was resolved, verify ownership
    if (vendor) {
      const isOwner =
        (targetOrder.vendorId && targetOrder.vendorId === vendor.id) ||
        (targetOrder.storeId && targetOrder.storeId === vendor.storeId) ||
        (targetOrder.storeName &&
          vendor.businessName &&
          targetOrder.storeName.toLowerCase() === vendor.businessName.toLowerCase());

      if (!isOwner) {
        return NextResponse.json(
          { error: "Forbidden", message: "You do not own this order." },
          { status: 403 }
        );
      }
    }

    const now = new Date();

    // Update order status
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: newStatus,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Log order event
    const eventNote =
      note ||
      (newStatus === "RESTAURANT_ACCEPTED"
        ? "Kitchen accepted order. Preparation started."
        : newStatus === "PREPARING"
        ? "Kitchen is preparing your meal."
        : newStatus === "READY_FOR_PICKUP"
        ? "Food is packaged and ready for rider pickup."
        : newStatus === "REJECTED"
        ? "Order was rejected by the restaurant."
        : `Status changed to ${newStatus}`);

    await db.insert(orderEvents).values({
      orderId,
      status: newStatus,
      note: eventNote,
      actor: "vendor",
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order #${orderId} status updated to ${newStatus}`,
    });
  } catch (error: any) {
    console.error("[vendor/orders/status] Error updating order status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update order status" },
      { status: 500 }
    );
  }
}
