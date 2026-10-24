import { NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderEvents } from "@/db/schema/orders";
import { vendors } from "@/db/schema/vendors";
import { requireVendor } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const orderId = String(body.orderId || body.id || "").trim();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
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

    // Verify ownership if vendor context exists
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
    const updatePayload: Record<string, any> = {
      updatedAt: now,
      isPreorder: true,
    };

    if (body.preorderReadyDate !== undefined) {
      updatePayload.preorderReadyDate = body.preorderReadyDate ? String(body.preorderReadyDate).trim() : null;
    }

    if (body.preorderReadyTime !== undefined) {
      updatePayload.preorderReadyTime = body.preorderReadyTime ? String(body.preorderReadyTime).trim() : null;
    }

    let statusToSet = targetOrder.status;
    let eventNote = "Pre-order schedule updated by kitchen.";

    if (body.isFoodReady !== undefined) {
      const isReady = Boolean(body.isFoodReady);
      updatePayload.isFoodReady = isReady;
      if (isReady) {
        updatePayload.foodReadyAt = now;
        statusToSet = "READY_FOR_PICKUP";
        updatePayload.status = "READY_FOR_PICKUP";
        eventNote = "Kitchen marked pre-order meal as READY for delivery!";
      } else {
        updatePayload.foodReadyAt = null;
        if (targetOrder.status === "READY_FOR_PICKUP") {
          statusToSet = "PREPARING";
          updatePayload.status = "PREPARING";
        }
        eventNote = "Kitchen marked pre-order meal as still preparing.";
      }
    }

    const [updatedOrder] = await db
      .update(orders)
      .set(updatePayload)
      .where(eq(orders.id, orderId))
      .returning();

    await db.insert(orderEvents).values({
      orderId,
      status: statusToSet,
      note: eventNote,
      actor: "vendor",
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Pre-order #${orderId} schedule updated successfully`,
    });
  } catch (error: any) {
    console.error("[vendor/orders/schedule] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update pre-order schedule" },
      { status: 500 }
    );
  }
}
