import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema/orders";
import { vendors } from "@/db/schema/vendors";
import { requireVendor } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storeIdParam = url.searchParams.get("storeId");
    const vendorIdParam = url.searchParams.get("vendorId");
    const emailParam = url.searchParams.get("email");

    const auth = await requireVendor(request, {
      storeId: storeIdParam || undefined,
      vendorId: vendorIdParam || undefined,
      email: emailParam || undefined,
    });

    let vendor = auth.ok ? auth.vendor : null;

    // Fallback: If session not authenticated, check query params or header for storeId / vendorId
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
      } else if (emailParam) {
        const clean = emailParam.trim().toLowerCase();
        const rows = await db
          .select()
          .from(vendors)
          .where(sql`LOWER(${vendors.contactEmail}) = ${clean}`)
          .limit(1);
        if (rows[0]) vendor = rows[0];
      }
    }

    if (!vendor) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Vendor account not resolved." },
        { status: 401 }
      );
    }

    // Query all orders belonging to this vendor
    const orderConditions = [
      eq(orders.vendorId, vendor.id),
      eq(orders.storeId, vendor.storeId),
      sql`LOWER(${orders.storeName}) = LOWER(${vendor.businessName})`,
    ];

    const vendorOrders = await db
      .select()
      .from(orders)
      .where(or(...orderConditions))
      .orderBy(desc(orders.createdAt));

    // Fetch line items for these orders
    const orderIds = vendorOrders.map((o) => o.id);
    let itemsByOrder: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const allItems = await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));

      for (const item of allItems) {
        if (!itemsByOrder[item.orderId]) {
          itemsByOrder[item.orderId] = [];
        }
        itemsByOrder[item.orderId].push({
          id: item.id,
          orderId: item.orderId,
          menuItemId: item.menuItemId,
          name: item.name,
          qty: item.qty,
          price: item.unitPrice,
          unitPrice: item.unitPrice,
          itemTotal: item.itemTotal,
          selectedAddons: item.selectedAddons || [],
        });
      }
    }

    // Format orders for the vendor portal
    const formattedOrders = vendorOrders.map((o) => ({
      id: o.id,
      storeId: o.storeId,
      storeName: o.storeName,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryAddress: o.deliveryAddress,
      deliveryNotes: o.deliveryNotes,
      deliveryLocation: o.deliveryLocation,
      paymentMethod: o.paymentMethod,
      subtotal: o.subtotal,
      serviceFee: o.serviceFee,
      deliveryFee: o.deliveryFee,
      total: o.total,
      status: o.status,
      isPreorder: o.isPreorder ?? false,
      preorderReadyDate: o.preorderReadyDate ?? null,
      preorderReadyTime: o.preorderReadyTime ?? null,
      isFoodReady: o.isFoodReady ?? false,
      foodReadyAt: o.foodReadyAt ? o.foodReadyAt.toISOString() : null,
      pin: o.pin,
      riderId: o.riderId,
      riderName: o.riderName,
      createdAt: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: o.updatedAt ? o.updatedAt.toISOString() : new Date().toISOString(),
      items: itemsByOrder[o.id] || [],
    }));

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
    });
  } catch (error: any) {
    console.error("[vendor/orders] Error fetching orders:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch vendor orders" },
      { status: 500 }
    );
  }
}
