import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as usersSchema from "./schema/users";
import * as vendorsSchema from "./schema/vendors";
import * as menuItemsSchema from "./schema/menu-items";
import * as menuExtrasSchema from "./schema/menu-extras";
import * as menuItemSizesSchema from "./schema/menu-item-sizes";

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
    },
});

export * from "./schema/users";
export * from "./schema/vendors";
export * from "./schema/menu-items";
export * from "./schema/menu-extras";
export * from "./schema/menu-item-sizes";