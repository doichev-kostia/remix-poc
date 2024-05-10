import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "~/internal/db/drizzle.js";

await migrate(db, { migrationsFolder: "migrations" })
