import { pgTable, text, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { menuItems } from "./menu-items";

export const menuExtras = pgTable("menu_extras", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  menuItemId: text("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  price: integer("price").notNull().default(0),
  extraType: varchar("extra_type", { length: 20 }).notNull().default("optional"), // required | optional
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MenuExtra = typeof menuExtras.$inferSelect;
export type NewMenuExtra = typeof menuExtras.$inferInsert;
