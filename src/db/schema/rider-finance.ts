import { riders } from "./riders";
import { users } from "./users";
import { pgTable, varchar, integer, timestamp, boolean, text, bigint, index } from "drizzle-orm/pg-core";

/**
 * Rider Wallets
 *
 * `available`: cleared delivery earnings ready to withdraw (in Naira).
 * `processing`: amount currently reserved in pending withdrawal requests.
 * `totalEarned`: lifetime cumulative earnings from completed deliveries.
 */
export const riderWallets = pgTable("rider_wallets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  riderId: varchar("rider_id", { length: 64 })
    .notNull()
    .unique()
    .references(() => riders.id, { onDelete: "cascade" }),
  available: integer("available").notNull().default(0),
  processing: integer("processing").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Append-only Rider Financial Ledger
 */
export const riderWalletTransactions = pgTable(
  "rider_wallet_transactions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    riderId: varchar("rider_id", { length: 64 })
      .notNull()
      .references(() => riders.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(), // DELIVERY_EARNING | WITHDRAWAL_REQUESTED | WITHDRAWAL_APPROVED | WITHDRAWAL_REJECTED | ADMIN_ADJUSTMENT
    direction: varchar("direction", { length: 10 }).notNull(), // CREDIT | DEBIT
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
    status: varchar("status", { length: 20 }).notNull().default("COMPLETED"), // COMPLETED | PENDING | REJECTED | FAILED
    orderId: varchar("order_id", { length: 32 }),
    withdrawalId: varchar("withdrawal_id", { length: 64 }),
    description: text("description"),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_rider_wallet_tx_rider_id").on(t.riderId)]
);

/**
 * Rider Bank Accounts for Payouts
 */
export const riderBankAccounts = pgTable(
  "rider_bank_accounts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    riderId: varchar("rider_id", { length: 64 })
      .notNull()
      .references(() => riders.id, { onDelete: "cascade" }),
    bankCode: varchar("bank_code", { length: 30 }),
    bankName: varchar("bank_name", { length: 120 }).notNull(),
    accountNumber: varchar("account_number", { length: 30 }).notNull(),
    accountName: varchar("account_name", { length: 150 }).notNull(),
    isDefault: boolean("is_default").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_rider_bank_accounts_rider_id").on(t.riderId)]
);

/**
 * Rider Withdrawal Requests
 */
export const riderWithdrawals = pgTable(
  "rider_withdrawals",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    riderId: varchar("rider_id", { length: 64 })
      .notNull()
      .references(() => riders.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    fee: integer("fee").notNull().default(0),
    netAmount: integer("net_amount").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
    bankName: varchar("bank_name", { length: 120 }).notNull(),
    accountNumber: varchar("account_number", { length: 30 }).notNull(),
    accountName: varchar("account_name", { length: 150 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("PENDING_ADMIN_APPROVAL"), // PENDING_ADMIN_APPROVAL | APPROVED | PROCESSING | PAID | REJECTED | FAILED
    rejectionReason: text("rejection_reason"),
    reviewedBy: bigint("reviewed_by", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    payoutReference: varchar("payout_reference", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_rider_withdrawals_rider_id").on(t.riderId),
    index("idx_rider_withdrawals_status").on(t.status),
  ]
);

export type RiderWallet = typeof riderWallets.$inferSelect;
export type RiderWalletTransaction = typeof riderWalletTransactions.$inferSelect;
export type RiderBankAccount = typeof riderBankAccounts.$inferSelect;
export type RiderWithdrawal = typeof riderWithdrawals.$inferSelect;
