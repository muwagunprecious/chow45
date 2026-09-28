import { users } from "./users";
import { vendors } from "./vendors";
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * The server-side cart. Replaces `state.cart`, which used to live in
 * localStorage and therefore vanished on a different device and was trivially
 * editable by the customer.
 *
 * One cart per user (enforced by the unique index) and the platform's
 * "1 cart = 1 store" rule is a column-level invariant: a cart can point at
 * exactly one vendor, so an item from a second store cannot join it.
 */
export const carts = pgTable(
  "carts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vendorId: bigint("vendor_id", { mode: "number" })
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("carts_user_id_idx").on(t.userId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cartId: bigint("cart_id", { mode: "number" })
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),

    /**
     * Not a foreign key on purpose. A dish the customer already added can be
     * deleted by the vendor before checkout; the line must survive so the cart
     * still shows what it holds instead of erroring or silently losing items.
     */
    menuItemId: varchar("menu_item_id", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    img: text("img"),
    unitPrice: integer("unit_price").notNull().default(0),
    qty: integer("qty").notNull().default(1),
    itemTotal: integer("item_total").notNull().default(0),
    selectedAddons: jsonb("selected_addons")
      .$type<{ name: string; price: number }[]>()
      .notNull()
      .default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("cart_items_cart_id_idx").on(t.cartId)],
);

/** The user's saved drop-off addresses, capped at 8 by the API layer. */
export const addresses = pgTable(
  "addresses",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    label: varchar("label", { length: 60 }),
    address: text("address").notNull(),
    formattedAddress: text("formatted_address"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
    lga: varchar("lga", { length: 100 }),
    state: varchar("state", { length: 100 }),
    placeId: varchar("place_id", { length: 255 }),
    deliveryInstructions: text("delivery_instructions"),
    isDefault: boolean("is_default").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("addresses_user_id_idx").on(t.userId)],
);

/**
 * Saved foods and stores. `targetType` separates the two lists the client keeps
 * under `userProfile.favorites`; ids are text because a favourite can point at
 * either a `menu_items.id` or a `vendors.storeId`.
 */
export const favorites = pgTable(
  "favorites",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: varchar("target_type", { length: 20 }).notNull(), // food | store
    targetId: varchar("target_id", { length: 64 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("favorites_user_target_idx").on(t.userId, t.targetType, t.targetId),
    index("favorites_user_id_idx").on(t.userId),
  ],
);

export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
