import { nanoid } from "nanoid";

import { users } from "./users";
import { pgTable, varchar, boolean, timestamp, integer, numeric, real, bigint, text } from "drizzle-orm/pg-core";

/**
 * Delivery riders.
 *
 * `userId` is linked to `users.id`.
 * Accounts start as `PENDING_REVIEW` and must be approved by an admin
 * before the rider can go online or accept deliveries.
 */
export const riders = pgTable("riders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  publicId: varchar("public_id", { length: 21 })
    .notNull()
    .unique()
    .$defaultFn(() => nanoid()),

  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  vehicle: varchar("vehicle", { length: 255 }),
  avatar: text("avatar"),
  location: text("location"),

  // Identity Verification
  identityMethod: varchar("identity_method", { length: 30 }).default("NIN"), // NIN | MATRIC
  identityNumber: varchar("identity_number", { length: 100 }),
  institution: varchar("institution", { length: 150 }),

  // Status & Review Lifecycle
  applicationStatus: varchar("application_status", { length: 30 }).notNull().default("APPROVED"), // PENDING_REVIEW | APPROVED | REJECTED | SUSPENDED
  approvalStatus: varchar("approval_status", { length: 30 }).notNull().default("APPROVED"), // PENDING | APPROVED | REJECTED | SUSPENDED
  rejectionReason: text("rejection_reason"),
  suspensionReason: text("suspension_reason"),
  reviewedBy: bigint("reviewed_by", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),

  rating: real("rating").notNull().default(5),
  tripsCount: integer("trips_count").notNull().default(0),

  // Operational Availability
  isOnline: boolean("is_online").notNull().default(false),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLat: numeric("current_lat", { precision: 9, scale: 6 }),
  currentLng: numeric("current_lng", { precision: 9, scale: 6 }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Rider = typeof riders.$inferSelect;
export type NewRider = typeof riders.$inferInsert;
