import { migrate } from "drizzle-orm/node-postgres/migrator";
import { initDB } from "~/internal/db/drizzle.js";
import * as assert from "node:assert";

assert.ok(process.env.DB_URL)
const db = initDB(process.env.DB_URL!)

await migrate(db, { migrationsFolder: "migrations" })
