import { users } from "./users";
import { vendors } from "./vendors";
import { orders } from "./orders";
import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  numeric,
  bigint,
  index,
} from "drizzle-orm/pg-core";

/**
 * Applications to sell on the platform. Replaces `state.pendingVendors` and
 * `state.vendorOnboarding`.
 *
 * These were the worst offenders for local-only storage: an admin approving a
 * vendor edited one browser's localStorage, so the decision was invisible to
 * the applicant and lost on refresh. Approval now writes a `vendors` row in
 * the same transaction, which is what makes the decision actually stick.
 */
export const vendorApplications = pgTable(
  "vendor_applications",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    /** The public handle the applicant polls to learn the outcome. */
    applicationId: varchar("application_id", { length: 64 }).notNull().unique(),

    userId: bigint("user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),

    businessName: varchar("business_name", { length: 255 }).notNull(),
    ownerName: varchar("owner_name", { length: 255 }),
    ownerEmail: varchar("owner_email", { length: 255 }),
    ownerPhone: varchar("owner_phone", { length: 20 }),

    address: text("address"),
    lga: varchar("lga", { length: 100 }),
    pickupLat: numeric("pickup_lat", { precision: 9, scale: 6 }),
    pickupLng: numeric("pickup_lng", { precision: 9, scale: 6 }),

    cuisine: varchar("cuisine", { length: 100 }),
    openingTime: varchar("opening_time", { length: 50 }),
    closingTime: varchar("closing_time", { length: 50 }),
    coverImage: text("cover_image"),

    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | approved | rejected
    rejectionReason: text("rejection_reason"),
    reviewedBy: bigint("reviewed_by", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    /** The storefront created on approval, so the applicant can be pointed at it. */
    vendorId: bigint("vendor_id", { mode: "number" }).references(() => vendors.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("vendor_applications_user_id_idx").on(t.userId),
    index("vendor_applications_status_idx").on(t.status),
  ],
);

/**
 * A vendor's withdrawable balance, in naira.
 *
 * `available` is cleared earnings, `processing` is money already requested in
 * a withdrawal that has not been paid out yet. The two are kept separate so the
 * dashboard can show "pending" without pretending the money is gone.
 */
export const vendorWallets = pgTable("vendor_wallets", {
  vendorId: bigint("vendor_id", { mode: "number" })
    .primaryKey()
    .references(() => vendors.id, { onDelete: "cascade" }),
  available: integer("available").notNull().default(0),
  processing: integer("processing").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Payout requests. Replaces `state.vendorWithdrawals`. */
export const vendorWithdrawals = pgTable(
  "vendor_withdrawals",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    vendorId: bigint("vendor_id", { mode: "number" })
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),

    amount: integer("amount").notNull(),
    bankName: varchar("bank_name", { length: 120 }),
    accountNumber: varchar("account_number", { length: 20 }),
    status: varchar("status", { length: 20 }).notNull().default("processing"), // processing | paid | rejected
    paidOutAt: timestamp("paid_out_at", { withTimezone: true }),
    expectedPayDate: timestamp("expected_pay_date", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("vendor_withdrawals_vendor_id_idx").on(t.vendorId)],
);

/** Customer-raised complaints about an order. Replaces `state.disputes`. */
export const disputes = pgTable(
  "disputes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    orderId: varchar("order_id", { length: 32 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),

    reason: varchar("reason", { length: 100 }).notNull(),
    details: text("details"),
    status: varchar("status", { length: 20 }).notNull().default("open"), // open | resolved
    resolution: text("resolution"),
    resolvedBy: bigint("resolved_by", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("disputes_order_id_idx").on(t.orderId), index("disputes_status_idx").on(t.status)],
);

/**
 * Platform-wide counters shown on the admin dashboard. Single-row table.
 *
 * These are a running total maintained inside the same transaction as the
 * order write, because an admin dashboard that silently disagrees with the
 * order table is worse than no dashboard.
 */
export const platformLedgers = pgTable("platform_ledgers", {
  id: integer("id").primaryKey().default(1),
  totalGmv: integer("total_gmv").notNull().default(0),
  totalServiceFees: integer("total_service_fees").notNull().default(0),
  completedDeliveries: integer("completed_deliveries").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type VendorApplication = typeof vendorApplications.$inferSelect;
export type VendorWallet = typeof vendorWallets.$inferSelect;
export type VendorWithdrawal = typeof vendorWithdrawals.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
export type PlatformLedger = typeof platformLedgers.$inferSelect;
