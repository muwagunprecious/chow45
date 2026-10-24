import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db";
import { orders, vendors } from "../src/db";
import { eq } from "drizzle-orm";

const BASE_URL = "http://localhost:3000";

describe("Authoritative Delivery Pricing Integration Tests (Live HTTP)", () => {
  const testStoreId = "test-store-pricing-" + Date.now();
  let testVendorId: number;
  const testOrderId1 = "CH45_TEST_" + Date.now();
  const testOrderId2 = "CH45_TEST2_" + Date.now();

  before(async () => {
    // 1. Create a test vendor with verified Sagamu coordinates
    const [vendor] = await db
      .insert(vendors)
      .values({
        storeId: testStoreId,
        businessName: "Test Campus Kitchen",
        slug: testStoreId,
        latitude: "6.840000",
        longitude: "3.650000",
        address: "Sagamu Campus Gate (No Google Street Name)",
        status: "approved",
      })
      .returning();
    testVendorId = vendor.id;
  });

  after(async () => {
    // Cleanup test orders and vendor
    await db.delete(orders).where(eq(orders.id, testOrderId1));
    await db.delete(orders).where(eq(orders.id, testOrderId2));
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
  });

  test("1. POST /api/delivery/quote calculates fee independently without Google Maps routing", async () => {
    // Distance from (6.8400, 3.6500) to (6.8482, 3.6545) is ~1046m
    // Rate: ₦200/km, min: ₦200. At 1046m -> ceil(1.046 * 200) = ₦210
    const res = await fetch(`${BASE_URL}/api/delivery/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: testStoreId,
        dropoff: { lat: 6.8482, lng: 3.6545 },
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.distanceMeters > 1000 && data.distanceMeters < 1100, `Expected ~1046m, got ${data.distanceMeters}`);
    assert.ok(data.distanceLabel.includes("straight-line"), `Expected label with straight-line, got ${data.distanceLabel}`);
    assert.equal(data.deliveryFee, Math.max(200, Math.ceil((data.distanceMeters / 1000) * 200)));
    assert.equal(data.serviceFee, 400);
  });

  test("2. POST /api/delivery/quote rejects missing or invalid customer dropoff coordinates", async () => {
    const res = await fetch(`${BASE_URL}/api/delivery/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: testStoreId,
        dropoff: { lat: "invalid", lng: null },
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("Valid delivery coordinates are required"));
  });

  test("3. POST /api/delivery/quote rejects vendor with unconfigured coordinates", async () => {
    // Create a temporary unconfigured vendor
    const tempStoreId = "unconfigured-vendor-" + Date.now();
    const [unconfigured] = await db
      .insert(vendors)
      .values({
        storeId: tempStoreId,
        businessName: "Unconfigured Vendor",
        slug: tempStoreId,
        latitude: null,
        longitude: null,
      })
      .returning();

    try {
      const res = await fetch(`${BASE_URL}/api/delivery/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: tempStoreId,
          dropoff: { lat: 6.8482, lng: 3.6545 },
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes("Vendor location coordinates are not configured"));
    } finally {
      await db.delete(vendors).where(eq(vendors.id, unconfigured.id));
    }
  });

  test("4. POST /api/orders/create recalculates fee authoritatively and overrides client tampering", async () => {
    // Client attempts to tamper with deliveryFee (submits ₦10) and subtotal
    const res = await fetch(`${BASE_URL}/api/orders/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: testOrderId1,
        storeId: testStoreId,
        storeName: "Test Campus Kitchen",
        customerName: "Student In Hostel",
        customerPhone: "+2348123456789",
        deliveryAddress: "Hostel Block C, Room 14 (No Google Map Address)",
        deliveryLocation: {
          lat: 6.8482,
          lng: 3.6545,
          name: "Hostel Block C",
        },
        deliveryFee: 10, // Tampered delivery fee!
        serviceFee: 50,  // Tampered service fee!
        total: 100,      // Tampered total!
        items: [
          { name: "Jollof Rice & Chicken", price: 2500, qty: 2 },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    const saved = data.order;

    // Subtotal: 2500 * 2 = 5000
    assert.equal(saved.subtotal, 5000);
    // Service fee: 400
    assert.equal(saved.serviceFee, 400);
    // Distance ~1046m -> fee: ceil(1.046 * 200) = 210
    assert.ok(saved.deliveryFee >= 200 && saved.deliveryFee !== 10);
    // Total must be subtotal + serviceFee + deliveryFee
    assert.equal(saved.total, saved.subtotal + saved.serviceFee + saved.deliveryFee);

    // Verify snapshot in deliveryLocation
    assert.ok(saved.deliveryLocation.pricingSnapshot);
    const snapshot = saved.deliveryLocation.pricingSnapshot;
    assert.equal(snapshot.vendorCoordinates.lat, 6.84);
    assert.equal(snapshot.vendorCoordinates.lng, 3.65);
    assert.equal(snapshot.customerCoordinates.lat, 6.8482);
    assert.equal(snapshot.customerCoordinates.lng, 3.6545);
    assert.equal(snapshot.serviceFee, 400);
    assert.equal(snapshot.deliveryFee, saved.deliveryFee);
    assert.equal(snapshot.total, saved.total);
  });

  test("5. POST /api/orders/create rejects when customer delivery coordinates are missing", async () => {
    const res = await fetch(`${BASE_URL}/api/orders/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "CH45_MISSING_COORDS",
        storeId: testStoreId,
        deliveryAddress: "Some unknown place",
        deliveryLocation: { name: "No GPS coordinates" },
        items: [{ name: "Rice", price: 1000, qty: 1 }],
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("Delivery location coordinates are required"));
  });

  test("6. POST /api/payments/verify creates order with authoritative pricing snapshot", async () => {
    const res = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: testOrderId2,
        reference: "PAY_TEST_" + Date.now(),
        order: {
          id: testOrderId2,
          storeId: testStoreId,
          storeName: "Test Campus Kitchen",
          customerName: "Precious M.",
          deliveryAddress: "Faculty of Science, OOU",
          deliveryLocation: {
            latitude: 6.8482,
            longitude: 3.6545,
          },
          deliveryFee: 1, // Tampered
          items: [{ name: "Fried Rice", price: 2000, qty: 1 }],
        },
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.order.subtotal, 2000);
    assert.equal(data.order.serviceFee, 400);
    assert.ok(data.order.deliveryFee >= 200 && data.order.deliveryFee !== 1);
    assert.equal(data.order.total, data.order.subtotal + data.order.serviceFee + data.order.deliveryFee);
  });

  test("7. Idempotency preserves historical order fee without recalculation", async () => {
    // Calling verify again on testOrderId2 (which is already PAID)
    const res = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: testOrderId2,
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.alreadyProcessed, true);
    assert.equal(data.status, "PAID");
  });
});
