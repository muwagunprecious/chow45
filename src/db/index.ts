import { config } from "dotenv";
// `.env.local` takes precedence when it exists, matching Next.js precedence, and
// `.env` is the committed fallback. Loading both matters for scripts run outside
// Next (`npm run db:seed`, scratch scripts): the Pool captures the connection
// string at construction time, so a missing `.env.local` would leave it holding
// `undefined` and every query would fail against localhost.
config({ path: ".env.local" });
config({ path: ".env" });
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as usersSchema from "./schema/users";
import * as vendorsSchema from "./schema/vendors";
import * as menuItemsSchema from "./schema/menu-items";
import * as menuExtrasSchema from "./schema/menu-extras";
import * as menuItemSizesSchema from "./schema/menu-item-sizes";
import * as deliverySchema from "./schema/delivery";
import * as ridersSchema from "./schema/riders";
import * as ordersSchema from "./schema/orders";
import * as cartSchema from "./schema/cart";
import * as vendorFinanceSchema from "./schema/vendor-finance";
import * as riderFinanceSchema from "./schema/rider-finance";
import * as categoriesSchema from "./schema/categories";
import * as waitlistSchema from "./schema/waitlist";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
});

export const db = drizzle({ client: pool,
    schema: {
        ...usersSchema,
        ...vendorsSchema,
        ...menuItemsSchema,
        ...menuExtrasSchema,
        ...menuItemSizesSchema,
        ...deliverySchema,
        ...ridersSchema,
        ...ordersSchema,
        ...cartSchema,
        ...vendorFinanceSchema,
        ...riderFinanceSchema,
        ...categoriesSchema,
        ...waitlistSchema,
    },
});

export * from "./schema/users";
export * from "./schema/vendors";
export * from "./schema/menu-items";
export * from "./schema/menu-extras";
export * from "./schema/menu-item-sizes";
export * from "./schema/delivery";
export * from "./schema/riders";
export * from "./schema/orders";
export * from "./schema/cart";
export * from "./schema/vendor-finance";
export * from "./schema/rider-finance";
export * from "./schema/categories";
export * from "./schema/waitlist";
