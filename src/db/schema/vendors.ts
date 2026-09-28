import { users } from "./users";
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  boolean,
  text,
  jsonb,
  timestamp,
  numeric,
  integer,
  real,
} from "drizzle-orm/pg-core";

/**
 * A vendor row is both the vendor's account profile and the public storefront
 * customers browse. `vendors.id` is the internal bigserial used by foreign
 * keys; `storeId` is the stable external id the client has always used
 * (`rest-mama-t`, `rest-iya-moria`) and is what the API serialises as `id`.
 *
 * `userId` is nullable so seeded storefronts can exist without a signed-in
 * owner. A null `userId` marks a store that nobody manages yet; admin approval
 * of an application attaches the real owner.
 */
export const vendors = pgTable("vendors", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .unique()
    .references(() => users.id, { onDelete: "set null" }),

  storeId: varchar("store_id", { length: 64 }).notNull().unique(),

  businessName: varchar("business_name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), //pending, approved, paused, rejected
  cuisine: varchar("cuisine", { length: 100 }),

  ownerName: varchar("owner_name", { length: 255 }),
  ownerPhone: varchar("owner_phone", { length: 20 }),
  /**
   * Where order and payout notices go. Kept apart from `users.email`, which is
   * the login identity managed by Better Auth, so a profile update cannot
   * redirect sign-in to an address the vendor does not control.
   */
  contactEmail: varchar("contact_email", { length: 255 }),

  image: text("image"),
  bannerImage: text("banner_image"),

  rating: real("rating").notNull().default(5),
  reviewsCount: integer("reviews_count").notNull().default(0),
  prepTime: varchar("prep_time", { length: 50 }),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  openingTime: varchar("opening_time", { length: 50 }),
  closingTime: varchar("closing_time", { length: 50 }),
  operatingHours: jsonb("operating_hours"),

  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  address: text("address"),

  isOpen: boolean("is_open").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  isBudget: boolean("is_budget").notNull().default(false),
  isRecommended: boolean("is_recommended").notNull().default(false),
  isPopular: boolean("is_popular").notNull().default(false),
  isFast: boolean("is_fast").notNull().default(false),
  category: varchar("category", { length: 100 }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),

  // "seed" for the bundled demo dataset, "vendor" for a store a real vendor
  // signed up for. Admins filter on this to tell the two apart.
  source: varchar("source", { length: 20 }).notNull().default("vendor"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
