import { timestamptz } from "drizzle-orm/gel-core";
import { users } from "./users";
import { pgTable,bigserial, bigint, varchar, boolean, text, jsonb, timestamp, unique, numeric} from "drizzle-orm/pg-core";

export const vendors = pgTable("vendors",{
    id: bigserial("id", { mode: "number"}).primaryKey(),
    user_id: bigint("user_id", {mode: "number"}).notNull().unique().references(() => users.id, {onDelete: "cascade"}),

    businessName: varchar("business_name", {length : 255}).notNull(),
    description: text("description"),
    status: varchar("status", {length: 20}).notNull().default("pending"), //pending, approved, paused

    image: text("image"),

    operatingHours: jsonb("operating_hours"),

    latitude: numeric("latitude", { precision: 9, scale:6 }),
    longitude: numeric("longitude", {precision: 9, scale: 6}),
    address: text("address"),

    createdAt: timestamp("created_at", { withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true}).defaultNow().notNull(),
});