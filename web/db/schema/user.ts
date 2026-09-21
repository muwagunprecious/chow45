import { pgTable, text, timestamp, boolean, pgEnum} from "drizzle-orm/pg-core"

//Defining the role enumf for customer, vendor and admin
export const roleEnum = pgEnum("role", ["customer", "vendor", "admin"]);

export const user = pgTable("user",{
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneNumber: text("phone_number").unique(),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    image: text("image"),
    role: roleEnum("role").notNull().default("customer"),
    createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow().$onUpdate(() => new Date()),
})
