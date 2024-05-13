import { Context } from "~/internal/context.js";
import { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { db, type DB } from "~/internal/db/drizzle.js";

type TxOrDb = PgTransaction<NodePgQueryResultHKT> | DB;

export const TransactionContext = Context.create<{
	tx: TxOrDb
}>("Transaction");

export async function useTransaction<T>(callback: (tx: TxOrDb) => Promise<T>) {
	const [ctx, err] = TransactionContext.use();

	if (err) {
		return callback(db);
	} else {
		return callback(ctx.tx);
	}
}

export async function createTransaction<T>(callback: (tx: TxOrDb) => Promise<T>) {
	const [ctx, err] = TransactionContext.use();

	if (ctx) {
		return callback(ctx.tx);
	} else {
		return await db
			.transaction(async tx => {
				return await TransactionContext.with({tx}, async () => {
					return callback(tx);
				});
			}, {
				isolationLevel: "serializable",
			});

	}
}
