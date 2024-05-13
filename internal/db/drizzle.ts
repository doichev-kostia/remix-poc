import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { config } from "~/app/.server/config.js";

import pg from "pg";

const pool = new pg.Pool({
	connectionString: config.dbURI,
});

export	const db = drizzle(pool);


export type DB = NodePgDatabase<Record<string, never>>;
