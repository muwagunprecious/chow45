import { pgTable, varchar, boolean, timestamp, integer, numeric, jsonb, real } from "drizzle-orm/pg-core";

/**
 * Delivery geography and fee configuration.
 *
 * These three tables replace the `CHOW45_SERVICE_ZONES`, `CHOW45_LOCATIONS` and
 * `DEFAULT_DELIVERY_FEE_CONFIG` constants that used to live in
 * `public/app/js/service-zones.js` and `public/app/js/data.js`. Admins edit
 * them through the Admin panel; every read now comes from Postgres.
 *
 * Polygons are stored as jsonb arrays of `[lng, lat]` pairs, matching the
 * ray-casting helper the client already uses. Coordinates are `lng, lat`
 * throughout — swapping them silently inverts every zone.
 */

/** A closed `[lng, lat]` ring describing where the platform delivers. */
export const serviceZones = pgTable("service_zones", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  state: varchar("state", { length: 100 }),
  lga: varchar("lga", { length: 100 }),
  /** `[lng, lat]` centre used for distance checks and map fitting. */
  center: jsonb("center").$type<[number, number]>().notNull(),
  maxDeliveryDistance: integer("max_delivery_distance").notNull().default(3000),
  deliveryRules: jsonb("delivery_rules")
    .$type<{ baseFee: number; ratePerMeter: number; serviceFee: number }>()
    .notNull(),
  operatingHours: jsonb("operating_hours")
    .$type<{ open: string; close: string }>()
    .notNull(),
  polygon: jsonb("polygon").$type<[number, number][]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Platform-wide delivery fee rules. Single-row table: the id is pinned to 1 by
 * a check constraint in the migration, so a second row cannot be inserted and
 * silently become the config the app reads.
 *
 *   deliveryFee = baseFee + (routeDistanceMeters * ratePerMeter)
 *   serviceFee  = flat mandatory fee per order
 */
export const deliveryConfigs = pgTable("delivery_configs", {
  id: integer("id").primaryKey().default(1),
  baseFee: integer("base_fee").notNull().default(300),
  serviceFee: integer("service_fee").notNull().default(400),
  /** Stored as a fraction of one naira, so 200 is kept exactly. */
  ratePerMeter: real("rate_per_meter").notNull().default(200),
  minDeliveryFee: integer("min_delivery_fee").notNull().default(300),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Saved drop-off points offered in the location picker. */
export const deliveryLocations = pgTable("delivery_locations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
  city: varchar("city", { length: 100 }),
  type: varchar("type", { length: 30 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * The coarse state boundary used to tell "inside Ogun but outside every active
 * zone" apart from "outside the state entirely". Stored as a single `[lng, lat]`
 * ring rather than a table because there is only ever one.
 */
export const stateBoundaries = pgTable("state_boundaries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  polygon: jsonb("polygon").$type<[number, number][]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ServiceZone = typeof serviceZones.$inferSelect;
export type DeliveryConfig = typeof deliveryConfigs.$inferSelect;
export type DeliveryLocation = typeof deliveryLocations.$inferSelect;
