import { useTransaction } from "~/internal/db/transaction.js";
import { identifiers, type IdentifierType, accounts } from "~/internal/db/schema.js";
import { and, eq, sql } from "drizzle-orm";
import * as E from "effect/Either";
import { createId } from "@paralleldrive/cuid2";
import type { Brand } from "effect/Brand";
import { NoRecordError } from "../errors.js";

export type Cuid = string & Brand<"Cuid">;
export type ValidPassword = string & Brand<"ValidPassword">;
export type NonExistingIdentifier = string & Brand<"NonExistingIdentifier">

type User = typeof accounts.$inferSelect;
type Identifier = typeof accounts.$inferSelect;

type UserData = {
	id?: Cuid;
	firstName: string;
	lastName: string;
	identifier: {
		type: IdentifierType;
		value: NonExistingIdentifier;
	}
};

async function createUser(data: UserData): Promise<E.Either<User, Error>> {
	try {
		const result = await useTransaction(async tx => {
			const user = await tx.insert(accounts)
				.values({
					id: data.id || createId(),
					firstName: data.firstName,
					lastName: data.lastName,
				})
				.returning()
				.then(rows => rows[0]);

			if (!user) {
				throw new Error("Failed get the user after insertion")
			}

			// TODO: insert identifiers

			return user;
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
 * @throws {NoRecordError} in case the user not found
 * @param type
 * @param value
 */
async function fromIdentifier(type: IdentifierType, value: string): Promise<E.Either<User, Error>> {
	try {
		return await useTransaction(async tx => {
			const user = await tx
				.select({
					users: accounts
				})
				.from(accounts)
				.innerJoin(identifiers, eq(identifiers.userID, accounts.id))
				.where(and(
					eq(identifiers.type, type),
					eq(identifiers.value, value)
				))
				.then(rows => rows[0]?.users);

			if (!user) {
				return E.left(NoRecordError);
			} else {
				return E.right(user);
			}
		});
	} catch (error) {
		return E.left(error)
	}
}


export const UserRepository= {
	createUser,
	identifierExists,
	fromIdentifier,
};
