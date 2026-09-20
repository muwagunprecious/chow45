import { config } from "dotenv";
import "server-only";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as userSchema from "./schema/user";
import * as countrySchema from "./schema/country";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// Preserve connection across hot-reloads in dev
const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.conn ??
  postgres(connectionString, {
    prepare: false,
    max: 1,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = client;
}

export const db = drizzle(client, {
  schema: { ...userSchema, ...countrySchema },
});