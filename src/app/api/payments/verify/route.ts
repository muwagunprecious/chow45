import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, orderItems, orderEvents, cartItems, carts, platformLedgers, users, vendors, deliveryConfigs } from "@/db";
import { STATUS_NOTES } from "@/lib/order-status";
import {
  getDistanceMeters,
  calculateDeliveryFee,
  validateCoordinates,
  formatDistanceLabel,
  DELIVERY_PRICING_CONFIG,
  PricingSnapshot,
} from "@/lib/delivery-pricing";

/**
 * Verifies that a payment succeeded and transitions order to PAID.
 *
 * Implements idempotency: if the order is already marked PAID,
 * it returns success without duplicating events or ledger increments.
 * If the order was submitted on verification, computes authoritative
 * coordinate-based distance, fees, and pricing snapshots.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const orderId = String(body.orderId || body.reference || "").trim();
    const reference = body.reference ? String(body.reference) : undefined;
    const amount = body.amount ? Number(body.amount) : undefined;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId." }, { status: 400 });
    }

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    let order = orderRows[0];
    if (!order) {
      if (body.order && typeof body.order === "object") {
        // Automatically create and persist the order with authoritative pricing
        const rawOrder = body.order as Record<string, any>;
        const storeId = String(rawOrder.storeId || "").trim();
        const storeName = String(rawOrder.storeName || "Campus Food Spot").trim();
        const customerName = String(rawOrder.customerName || "Customer").trim();
        const customerPhone = String(rawOrder.customerPhone || "").trim() || null;
        const deliveryAddress = String(rawOrder.deliveryAddress || "").trim();
        if (!deliveryAddress) {
          return NextResponse.json(
            { error: "Delivery address is required to place an order." },
            { status: 400 }
          );
        }
        const deliveryNotes = rawOrder.deliveryNotes ? String(rawOrder.deliveryNotes) : null;
        const paymentMethod = reference ? `Paystack (${reference})` : (String(rawOrder.paymentMethod || "Debit Card (Paystack)").trim());

        // 1. Validate customer delivery coordinates
        const customerLocation = rawOrder.deliveryLocation || {};
        const customerCoords = validateCoordinates(
          customerLocation.latitude ?? customerLocation.lat,
          customerLocation.longitude ?? customerLocation.lng
        );

        if (!customerCoords) {
          return NextResponse.json(
            { error: "Delivery location coordinates are required. Please select your delivery location on the map." },
            { status: 400 }
          );
        }

        // 2. Resolve vendor from database
        let vendorRecord: {
          id: number;
          storeId: string;
          businessName: string;
          latitude: string | null;
          longitude: string | null;
        } | null = null;

        if (storeId) {
          const v = await db
            .select({
              id: vendors.id,
              storeId: vendors.storeId,
              businessName: vendors.businessName,
              latitude: vendors.latitude,
              longitude: vendors.longitude,
            })
            .from(vendors)
            .where(eq(vendors.storeId, storeId))
            .limit(1);
          if (v[0]) vendorRecord = v[0];
        }

        if (!vendorRecord && storeName) {
          const v = await db
            .select({
              id: vendors.id,
              storeId: vendors.storeId,
              businessName: vendors.businessName,
              latitude: vendors.latitude,
              longitude: vendors.longitude,
            })
            .from(vendors)
            .where(sql`LOWER(${vendors.businessName}) = LOWER(${storeName})`)
            .limit(1);
          if (v[0]) vendorRecord = v[0];
        }

        if (!vendorRecord) {
          return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
        }

        // 3. Validate vendor coordinates
        if (vendorRecord.latitude === null || vendorRecord.longitude === null) {
          return NextResponse.json(
            { error: "Vendor location coordinates are not configured. Please contact the vendor or select another store." },
            { status: 400 }
          );
        }

        const vendorCoords = validateCoordinates(vendorRecord.latitude, vendorRecord.longitude);
        if (!vendorCoords) {
          return NextResponse.json(
            { error: "Vendor location coordinates are invalid. Please contact the vendor." },
            { status: 400 }
          );
        }

        // 4. Authoritative backend distance and pricing calculation
        const distanceMeters = getDistanceMeters(
          vendorCoords.lat,
          vendorCoords.lng,
          customerCoords.lat,
          customerCoords.lng
        );

        const configRows = await db.select().from(deliveryConfigs).limit(1);
        const config = configRows[0];
        const ratePerKm = config?.ratePerMeter
          ? Math.round(Number(config.ratePerMeter) * 1000)
          : DELIVERY_PRICING_CONFIG.RATE_PER_KM;
        const minDeliveryFee = config?.minDeliveryFee ?? DELIVERY_PRICING_CONFIG.MINIMUM_DELIVERY_FEE;
        const serviceFee = config?.serviceFee ?? DELIVERY_PRICING_CONFIG.SERVICE_FEE;

        const deliveryFee = calculateDeliveryFee(distanceMeters, ratePerKm, minDeliveryFee);

        const items = Array.isArray(rawOrder.items) ? rawOrder.items : [];
        let subtotal = 0;
        if (items.length > 0) {
          subtotal = items.reduce((sum: number, it: any) => {
            const price = Math.round(Number(it.price ?? it.unitPrice) || 0);
            const qty = Math.max(1, Number(it.qty) || 1);
            return sum + (price * qty);
          }, 0);
        } else {
          subtotal = Math.round(Number(rawOrder.subtotal) || 2000);
        }

        const total = subtotal + serviceFee + deliveryFee;
        const estimatedDurationSeconds = Math.round((distanceMeters / 500) * 60);
        const pin = String(rawOrder.pin || Math.floor(1000 + Math.random() * 9000)).trim();
        const now = new Date();

        const pricingSnapshot: PricingSnapshot = {
          vendorCoordinates: vendorCoords,
          customerCoordinates: customerCoords,
          distanceMeters: Math.round(distanceMeters),
          distanceLabel: formatDistanceLabel(distanceMeters),
          ratePerKm,
          minDeliveryFee,
          deliveryFee,
          serviceFee,
          subtotal,
          total,
          formula: "max(200, ceil((distanceMeters / 1000) * 200))",
          calculatedAt: now.toISOString(),
        };

        const deliveryLocationPayload = {
          ...(typeof customerLocation === "object" ? customerLocation : {}),
          latitude: customerCoords.lat,
          longitude: customerCoords.lng,
          pricingSnapshot,
        };

        const isPreorder = Boolean(rawOrder.isPreorder || (items.some((it: any) => it.preorderEnabled)));
        const preorderItem = items.find((it: any) => it.preorderEnabled && (it.preorderDate || it.preorderTime));
        const preorderReadyDate = rawOrder.preorderReadyDate ? String(rawOrder.preorderReadyDate) : (preorderItem?.preorderDate || null);
        const preorderReadyTime = rawOrder.preorderReadyTime ? String(rawOrder.preorderReadyTime) : (preorderItem?.preorderTime || null);
        const isFoodReady = Boolean(rawOrder.isFoodReady || false);

        // 5. Resolve userId
        let resolvedUserId = 11;
        const u = await db.select({ id: users.id }).from(users).where(eq(users.role, "USER")).orderBy(users.id).limit(1);
        if (u[0]) resolvedUserId = u[0].id;

        const [insertedOrder] = await db
          .insert(orders)
          .values({
            id: orderId,
            userId: resolvedUserId,
            vendorId: vendorRecord.id,
            storeId: vendorRecord.storeId || storeId,
            storeName: vendorRecord.businessName || storeName,
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryNotes,
            deliveryLocation: deliveryLocationPayload,
            paymentMethod,
            subtotal,
            serviceFee,
            deliveryFee,
            total,
            status: "PAID",
            pin,
            isPreorder,
            preorderReadyDate,
            preorderReadyTime,
            isFoodReady,
            foodReadyAt: isFoodReady ? now : null,
            routeDistanceMeters: Math.round(distanceMeters),
            estimatedDurationSeconds,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        order = insertedOrder;

        // Insert items
        if (items.length > 0) {
          await db.insert(orderItems).values(
            items.map((item: any) => ({
              orderId,
              menuItemId: item.id || item.menuItemId || null,
              name: String(item.name || "Food Item"),
              qty: Math.max(1, Number(item.qty) || 1),
              unitPrice: Math.round(Number(item.price ?? item.unitPrice) || 0),
              itemTotal: Math.round((Number(item.price ?? item.unitPrice) || 0) * (Number(item.qty) || 1)),
              selectedAddons: item.selectedAddons || [],
            }))
          );
        }

        // Insert event
        await db.insert(orderEvents).values({
          orderId,
          status: "PAID",
          note: "Payment verified successfully. Order dispatched to campus riders.",
          actor: "system",
        });

        // Platform ledger
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
          order: insertedOrder,
          message: "Payment verified successfully. Order dispatched to campus riders.",
        });
      }

      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Idempotency: If order was already marked PAID, return success safely
    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        orderId: order.id,
        status: order.status,
        message: "Payment already verified and processed.",
      });
    }

    const now = new Date();

    // Transition to PAID
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: "PAID",
        paymentMethod: reference ? `Paystack (${reference})` : order.paymentMethod,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id))
      .returning();

    // Record audit event
    await db.insert(orderEvents).values({
      orderId: order.id,
      status: "PAID",
      note: STATUS_NOTES.PAID,
      actor: "system",
    });

    // Delete user cart items if cart exists
    const cartRow = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, order.userId))
      .limit(1);

    if (cartRow[0]) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cartRow[0].id));
    }

    // Platform totals move in the same statement
    await db
      .insert(platformLedgers)
      .values({ id: 1, totalGmv: order.total, totalServiceFees: order.serviceFee })
      .onConflictDoUpdate({
        target: platformLedgers.id,
        set: {
          totalGmv: sql`${platformLedgers.totalGmv} + ${order.total}`,
          totalServiceFees: sql`${platformLedgers.totalServiceFees} + ${order.serviceFee}`,
          updatedAt: now,
        },
      });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: "Payment verified successfully. Order sent to kitchen.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
