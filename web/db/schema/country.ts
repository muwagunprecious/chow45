import { pgTable, text } from "drizzle-orm/pg-core";

export const country = pgTable("country", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  flag: text("flag").notNull(),
  phoneCode: text("phone_code").notNull(),
});