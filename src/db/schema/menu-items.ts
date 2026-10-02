import { pgTable, text, integer, boolean, timestamp, varchar, bigint } from "drizzle-orm/pg-core";
import { vendors } from "./vendors";

export const menuItems = pgTable("menu_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  category: varchar("category", { length: 100 }),
  priceType: varchar("price_type", { length: 20 }).notNull().default("plate"), // scoop | plate | both | piece
  /**
   * The single price the customer is shown and charged before extras, derived
   * from whichever of the three columns below `priceType` selects. The bundled
   * seed data mixes per-item pricing with scoop/plate and per-piece pricing, so
   * the effective price is stored rather than recomputed on every read, which
   * would otherwise need the whole pricing rule set in each serialiser.
   */
  price: integer("price").notNull().default(0),
  scoopPrice: integer("scoop_price"), // stored in kobo or naira
  platePrice: integer("plate_price"),
  piecePrice: integer("piece_price"),
  status: varchar("status", { length: 30 }).notNull().default("available"), // available | out_of_stock | preorder | hidden
  isPublished: boolean("is_published").notNull().default(true),
  preorderEnabled: boolean("preorder_enabled").notNull().default(false),
  preorderDate: varchar("preorder_date", { length: 100 }),
  preorderTime: varchar("preorder_time", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
