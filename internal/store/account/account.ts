import { useTransaction } from "~/internal/db/transaction.js";
import { identifiers, type IdentifierType, accounts } from "~/internal/db/schema.js";
import { and, eq, sql } from "drizzle-orm";
import * as E from "effect/Either";
import { createId } from "@paralleldrive/cuid2";
import type { Brand } from "effect/Brand";
import { NoRecordError } from "../errors.js";
import type { DB } from "~/internal/db/drizzle.js";

export type Cuid = string & Brand<"Cuid">;
export type ValidPassword = string & Brand<"ValidPassword">;
export type NonExistingIdentifier = string & Brand<"NonExistingIdentifier">

type Account = typeof accounts.$inferSelect;

type AccountData = {
	id?: Cuid;
	firstName: string;
	lastName: string;
	identifier: {
		type: IdentifierType;
		value: NonExistingIdentifier;
	}
};

type RepositoryOptions = {
	db: DB,
}

export function AccountStore(options?: RepositoryOptions) {

	async function createAccount(data: AccountData): Promise<E.Either<Account, Error>> {
		try {
			const result = await useTransaction(async tx => {
				const account = await tx.insert(accounts)
					.values({
						id: data.id || createId(),
						firstName: data.firstName,
						lastName: data.lastName,
					})
					.returning()
					.then(rows => rows[0]);

				if (!account) {
					throw new Error("Failed get the account after insertion")
				}

				// TODO: insert identifiers

				return account;
			});
			return E.right(result);
		} catch (error) {
			return E.left(error)
		}
	}

	async function identifierExists(type: IdentifierType, value: string): Promise<E.Either<boolean, Error>> {
		try {
			const exists = await useTransaction(async tx => {
				const result = await tx
					.select({
						count: sql<number>`cast(count(*) as int)`
					})
					.from(identifiers)
					.where(and(
						eq(identifiers.type, type),
						eq(identifiers.value, value)
					))
					.then(rows => rows[0].count > 0);

				return result;
			});

			return E.right(exists);
		} catch (error) {
			return E.left(error)
		}
	}

	/**
	 * @throws {NoRecordError} in case the account not found
	 * @param type
	 * @param value
	 */
	async function fromIdentifier(type: IdentifierType, value: string): Promise<E.Either<Account, Error>> {
		try {
			return await useTransaction(async tx => {
				const account = await tx
					.select({
						accounts: accounts
					})
					.from(accounts)
					.innerJoin(identifiers, eq(identifiers.accountID, accounts.id))
					.where(and(
						eq(identifiers.type, type),
						eq(identifiers.value, value)
					))
					.then(rows => rows[0]?.accounts);

				if (!account) {
					return E.left(NoRecordError);
				} else {
					return E.right(account);
				}
			});
		} catch (error) {
			return E.left(error)
		}
	}


	return {
		createAccount,
		identifierExists,
		fromIdentifier,
	};
}

