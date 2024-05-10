import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "~/internal/config.js";

import pg from "pg";

const pool = new pg.Pool({
	connectionString: config.DB_URL,
});

export const db = drizzle(pool);
