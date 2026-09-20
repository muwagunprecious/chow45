import { defineConfig } from "drizzle-kit"
import { config } from "dotenv";

//Load environment variables from .env.local
config({ path: ".env.local" });

export default defineConfig({
    dialect: "postgresql",
    schema: "./db/schema",
    out: "./drizzle",
    dbCredentials: {url: process.env.DATABASE_URL!}
});