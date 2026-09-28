import { users } from "./users";
import { vendors } from "./vendors";
import { riders } from "./riders";
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Orders, their line items and their status history.
 *
 * Replaces `state.orders` from the old localStorage store. Money columns are
 * integers in naira, matching `menu_items.price`.
 *
 * `id` is the short human code the customer reads out to the rider
 * (`CH45281`), so it is the primary key rather than a separate surrogate. The
 * status column is a plain varchar, not an enum, so the 13-stage state machine
 * in the client can evolve without a migration.
 */

/** Every stage an order can be in. Mirrors ORDER_STAGES on the client. */
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "RESTAURANT_ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "RIDER_ASSIGNED",
  "RIDER_HEADING_TO_STORE",
  "RIDER_AT_STORE",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "RIDER_NEARBY",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vendorId: bigint("vendor_id", { mode: "number" }).references(() => vendors.id, {
      onDelete: "set null",
    }),

    // Store name is snapshotted so the order still reads correctly if the
    // vendor renames the store or the row is removed later.
    storeId: varchar("store_id", { length: 64 }).notNull(),
    storeName: varchar("store_name", { length: 255 }).notNull(),

    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }),

    deliveryAddress: text("delivery_address").notNull(),
    deliveryNotes: text("delivery_notes"),
    /** Full resolved drop-off, kept for zone re-checks and map display. */
    deliveryLocation: jsonb("delivery_location"),

    paymentMethod: varchar("payment_method", { length: 100 }),

    subtotal: integer("subtotal").notNull(),
    serviceFee: integer("service_fee").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    total: integer("total").notNull(),

    status: varchar("status", { length: 30 }).notNull().default("PAID"),

    riderId: varchar("rider_id", { length: 64 }).references(() => riders.id, {
      onDelete: "set null",
    }),
    riderName: varchar("rider_name", { length: 255 }),

    /** 4-digit code the customer gives the rider to collect the order. */
    pin: varchar("pin", { length: 4 }),

    routeDistanceMeters: integer("route_distance_meters"),
    estimatedDurationSeconds: integer("estimated_duration_seconds"),

    // Review is written once, on delivery, so it lives on the order rather
    // than in a separate table.
    rating: integer("rating"),
    reviewComment: text("review_comment"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("orders_user_id_idx").on(t.userId),
    index("orders_vendor_id_idx").on(t.vendorId),
    index("orders_rider_id_idx").on(t.riderId),
    index("orders_status_idx").on(t.status),
  ],
);

/** Line items. Prices are snapshotted so a later menu edit cannot rewrite history. */
export const orderItems = pgTable(
  "order_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: varchar("order_id", { length: 32 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    /** Null when the dish has since been deleted from the menu. */
    menuItemId: varchar("menu_item_id", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    qty: integer("qty").notNull().default(1),
    unitPrice: integer("unit_price").notNull().default(0),
    itemTotal: integer("item_total").notNull().default(0),
    /** `{ name, price }[]` of the extras the customer picked. */
    selectedAddons: jsonb("selected_addons")
      .$type<{ name: string; price: number }[]>()
      .notNull()
      .default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("order_items_order_id_idx").on(t.orderId)],
);

/** Append-only status trail powering the order timeline. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: varchar("order_id", { length: 32 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).notNull(),
    note: text("note"),
    /** Which party caused the change, so the timeline can show an actor. */
    actor: varchar("actor", { length: 30 }).notNull().default("system"), // customer | vendor | rider | admin | system
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("order_events_order_id_idx").on(t.orderId)],
);

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
