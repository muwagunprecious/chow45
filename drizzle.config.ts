import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit runs outside of Next.js, so env vars must be loaded manually.
// .env.local takes precedence when it exists, matching Next.js precedence.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema",
    out: "./drizzle",
    dbCredentials: { url: process.env.DATABASE_URL! },
});
