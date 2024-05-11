import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import pg from "pg";

export function initDB(connectionURI: string) {
	const pool = new pg.Pool({
		connectionString: connectionURI,
	});

	const db = drizzle(pool);

	return db
}


export type DB = NodePgDatabase<Record<string, never>>;
