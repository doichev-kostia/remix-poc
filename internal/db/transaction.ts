import { Context, ContextNoDefaultError } from "~/internal/context.js";
import { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { DB } from "~/internal/db/drizzle.js";

type TxOrDb = PgTransaction<NodePgQueryResultHKT> | DB;

export const TransactionContext = Context.create<{
	tx: TxOrDb
}>("Transaction");

export async function useTransaction<T>(callback: (tx: TxOrDb) => Promise<T>) {
	const [ctx, err] = TransactionContext.use();

	if (err) {
		if (TransactionContext.defaultValue != null) {
			return callback(TransactionContext.defaultValue.tx);
		} else {
			throw new ContextNoDefaultError(TransactionContext.name)
		}
	} else {
		return callback(ctx.tx);
	}
}

export async function createTransaction<T>(callback: (tx: TxOrDb) => Promise<T>) {
	const [ctx, err] = TransactionContext.use();

	if (ctx) {
		return callback(ctx.tx);
	} else {
		if (TransactionContext.defaultValue == null) {
			throw new ContextNoDefaultError(TransactionContext.name)
		}

		return await TransactionContext.defaultValue.tx
			.transaction(async tx => {
				return await TransactionContext.with({tx}, async () => {
					return callback(tx);
				});
			}, {
				isolationLevel: "serializable",
			});

	}
}
