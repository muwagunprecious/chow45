import { users } from "./users";
import { pgTable, varchar, boolean, timestamp, integer, numeric, real, bigint, text } from "drizzle-orm/pg-core";

/**
 * Delivery riders. Replaces the `CHOW45_RIDERS` constant.
 *
 * `userId` is nullable for the same reason it is on `vendors`: seeded riders
 * exist before anyone signs up. When a rider creates an account the row is
 * linked and `isRider` flips on their user, which is what `requireRider` reads.
 */
export const riders = pgTable("riders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  publicId: varchar("public_id", { length: 21 }).notNull().unique().$defaultFn(() => nanoid()),

  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  vehicle: varchar("vehicle", { length: 255 }),
  avatar: text("avatar"),
  location: text("location"),

  rating: real("rating").notNull().default(5),
  tripsCount: integer("trips_count").notNull().default(0),

  isOnline: boolean("is_online").notNull().default(false),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLat: numeric("current_lat", { precision: 9, scale: 6 }),
  currentLng: numeric("current_lng", { precision: 9, scale: 6 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Rider = typeof riders.$inferSelect;
export type NewRider = typeof riders.$inferInsert;
