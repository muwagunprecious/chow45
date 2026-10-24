import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getDistanceMeters,
  calculateDeliveryFee,
  validateCoordinates,
  formatDistanceLabel,
  DELIVERY_PRICING_CONFIG,
} from "../src/lib/delivery-pricing";

describe("Distance Calculation (Haversine)", () => {
  test("Identical coordinates return 0 metres", () => {
    const lat = 6.8400;
    const lon = 3.6500;
    const distance = getDistanceMeters(lat, lon, lat, lon);
    assert.equal(distance, 0);
  });

  test("Known coordinate pair returns accurate distance", () => {
    // Sagamu OSUTH (6.8400, 3.6500) to Sagamu Main Gate (~6.8440, 3.6530)
    // dLat ~ 0.0040 (~444m), dLon ~ 0.0030 (~330m) -> distance ~ 554m
    const dist = getDistanceMeters(6.8400, 3.6500, 6.8440, 3.6530);
    assert.ok(dist > 500 && dist < 600, `Expected ~550m, got ${dist}`);
  });

  test("Reversing coordinates returns the exact same distance", () => {
    const lat1 = 6.7200;
    const lon1 = 3.3900;
    const lat2 = 6.8482;
    const lon2 = 3.6545;

    const d1 = getDistanceMeters(lat1, lon1, lat2, lon2);
    const d2 = getDistanceMeters(lat2, lon2, lat1, lon1);
    assert.equal(Math.round(d1 * 100), Math.round(d2 * 100));
  });

  test("Small coordinate changes produce plausible positive distances", () => {
    const d = getDistanceMeters(6.8400, 3.6500, 6.8401, 3.6500);
    // 0.0001 deg latitude is approx 11.1 metres
    assert.ok(d > 10 && d < 12, `Expected ~11.1m, got ${d}`);
  });

  test("Latitude and longitude boundary values are handled correctly", () => {
    // North pole to South pole along 0 meridian: half earth circumference: ~20,015,087 metres
    const poleToPole = getDistanceMeters(90, 0, -90, 0);
    assert.ok(
      Math.abs(poleToPole - Math.PI * DELIVERY_PRICING_CONFIG.EARTH_RADIUS_METERS) < 1,
      `Expected half circumference, got ${poleToPole}`
    );

    // Opposite longitude along equator: ~20,015,087 metres
    const dateLine = getDistanceMeters(0, -180, 0, 180);
    assert.ok(dateLine >= 0 && Number.isFinite(dateLine));
  });

  test("Rejects out-of-range coordinates", () => {
    assert.throws(() => getDistanceMeters(91, 0, 0, 0), /Coordinates are outside valid ranges/);
    assert.throws(() => getDistanceMeters(-91, 0, 0, 0), /Coordinates are outside valid ranges/);
    assert.throws(() => getDistanceMeters(0, 181, 0, 0), /Coordinates are outside valid ranges/);
    assert.throws(() => getDistanceMeters(0, -181, 0, 0), /Coordinates are outside valid ranges/);
  });

  test("Rejects invalid non-numeric, NaN, and Infinity inputs", () => {
    assert.throws(() => getDistanceMeters(NaN as any, 0, 0, 0), /Invalid delivery coordinates/);
    assert.throws(() => getDistanceMeters(0, Infinity as any, 0, 0), /Invalid delivery coordinates/);
    assert.throws(() => getDistanceMeters("6.84" as any, 0, 0, 0), /Invalid delivery coordinates/);
    assert.throws(() => getDistanceMeters(null as any, 0, 0, 0), /Invalid delivery coordinates/);
    assert.throws(() => getDistanceMeters(undefined as any, 0, 0, 0), /Invalid delivery coordinates/);
  });

  test("Result is never negative or non-finite for valid inputs", () => {
    const d = getDistanceMeters(0, 0, 0, 0);
    assert.ok(d >= 0);
    assert.ok(Number.isFinite(d));
  });
});

describe("Delivery Fee Calculation Policy", () => {
  test("Formula: deliveryFee = max(200, ceil((distanceMeters / 1000) * 200))", () => {
    // 0 - 1,000m -> ₦200
    assert.equal(calculateDeliveryFee(0), 200);
    assert.equal(calculateDeliveryFee(100), 200);
    assert.equal(calculateDeliveryFee(500), 200);
    assert.equal(calculateDeliveryFee(1000), 200);

    // 1,250m -> ₦250
    assert.equal(calculateDeliveryFee(1250), 250);

    // 1,500m -> ₦300
    assert.equal(calculateDeliveryFee(1500), 300);

    // 2,000m -> ₦400
    assert.equal(calculateDeliveryFee(2000), 400);

    // 2,750m -> ₦550
    assert.equal(calculateDeliveryFee(2750), 550);

    // 3,500m -> ₦700
    assert.equal(calculateDeliveryFee(3500), 700);

    // 5,000m -> ₦1,000
    assert.equal(calculateDeliveryFee(5000), 1000);

    // 10,000m -> ₦2,000
    assert.equal(calculateDeliveryFee(10000), 2000);
  });

  test("Ceil rounds up fractional naira to next whole naira", () => {
    // 1,001 metres -> (1.001 * 200) = 200.2 -> ceil is 201
    assert.equal(calculateDeliveryFee(1001), 201);
    // 1,010 metres -> (1.01 * 200) = 202 -> 202
    assert.equal(calculateDeliveryFee(1010), 202);
  });

  test("Rejects invalid negative or non-finite distances", () => {
    assert.throws(() => calculateDeliveryFee(-1), /Invalid delivery distance/);
    assert.throws(() => calculateDeliveryFee(NaN), /Invalid delivery distance/);
    assert.throws(() => calculateDeliveryFee(Infinity), /Invalid delivery distance/);
    assert.throws(() => calculateDeliveryFee("1000" as any), /Invalid delivery distance/);
  });

  test("Dynamic rate and minimum fee configuration", () => {
    // Custom rate of ₦300/km and minimum ₦300
    assert.equal(calculateDeliveryFee(500, 300, 300), 300);
    assert.equal(calculateDeliveryFee(1500, 300, 300), 450);
    assert.equal(calculateDeliveryFee(2000, 300, 300), 600);
  });
});

describe("Coordinate Validation and Formatting Helpers", () => {
  test("validateCoordinates returns parsed numbers for valid inputs", () => {
    assert.deepEqual(validateCoordinates(6.84, 3.65), { lat: 6.84, lng: 3.65 });
    assert.deepEqual(validateCoordinates("6.84", "3.65"), { lat: 6.84, lng: 3.65 });
  });

  test("validateCoordinates returns null for invalid inputs", () => {
    assert.equal(validateCoordinates(null, 3.65), null);
    assert.equal(validateCoordinates(6.84, null), null);
    assert.equal(validateCoordinates("not-a-number", 3.65), null);
    assert.equal(validateCoordinates(95, 3.65), null); // lat > 90
    assert.equal(validateCoordinates(6.84, 185), null); // lng > 180
  });

  test("formatDistanceLabel outputs straight-line label correctly", () => {
    assert.equal(formatDistanceLabel(850), "850 m (straight-line)");
    assert.equal(formatDistanceLabel(1500), "1.50 km (straight-line)");
    assert.equal(formatDistanceLabel(2750), "2.75 km (straight-line)");
    assert.equal(formatDistanceLabel(10000), "10.00 km (straight-line)");
  });
});
