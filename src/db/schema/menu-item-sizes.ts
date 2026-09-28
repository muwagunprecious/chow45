import { pgTable, text, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { menuItems } from "./menu-items";

/**
 * Size variants for a by-piece menu item, e.g. Small / Medium / Large, or
 * Regular / Large for a drink. When a customer picks a size, its price
 * replaces the item's per-piece price rather than adding to it.
 *
 * Only populated for categories sold by piece (drinks, snacks, grills,
 * shawarma, others). Portion items keep using scoop/plate pricing.
 */
export const menuItemSizes = pgTable("menu_item_sizes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  menuItemId: text("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  price: integer("price").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MenuItemSize = typeof menuItemSizes.$inferSelect;
export type NewMenuItemSize = typeof menuItemSizes.$inferInsert;
