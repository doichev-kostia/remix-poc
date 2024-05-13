import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as assert from "node:assert";
import { db } from "~/internal/db/drizzle.js";

assert.ok(process.env.DB_URI)

await migrate(db, { migrationsFolder: "migrations" })
