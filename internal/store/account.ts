import { useTransaction } from "~/internal/db/transaction.js";
import {
	accounts,
	IDENTIFIER_TYPE,
	identifiers,
	type IdentifierType,
	memberships,
	workspaces
} from "~/internal/db/schema.js";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import * as E from "effect/Either";
import { createId } from "@paralleldrive/cuid2";
import type { Brand } from "effect/Brand";
import { NoRecordError } from "~/internal/store/errors.js";
import { hash, verify } from "@node-rs/argon2";
import format from "quick-format-unescaped";
import { z } from "zod";

export type Cuid = string & Brand<"Cuid">;
export type ValidPassword = string & Brand<"ValidPassword">;
export type NonExistingIdentifier = string & Brand<"NonExistingIdentifier">

type AccountData = {
	id?: Cuid;
	firstName: string;
	lastName: string;
	password: ValidPassword;
	email: NonExistingIdentifier;
};

const PreferencesSchema = z.object({
	lastUsedWorkspace: z.string().optional(),
}).passthrough();

export type Preferences = z.infer<typeof PreferencesSchema>;

type Account = typeof accounts.$inferSelect & {
	preferences: Preferences
};

type AccountWithEmail = Account & {
	email: string;
}

export type Workspace = typeof workspaces.$inferSelect;
export type Membership = typeof memberships.$inferSelect

export type WorkspaceWithMember = Workspace & {
	membership: Membership
}


const TIME_COST = 12;

async function createEmailAccount(data: AccountData): Promise<E.Either<AccountWithEmail, Error>> {
	try {
		const result = await useTransaction(async tx => {
			const password = await hash(data.password, {
				timeCost: TIME_COST,
			});

			const account = await tx.insert(accounts)
				.values({
					id: data.id || createId(),
					firstName: data.firstName,
					lastName: data.lastName,
					password: password
				})
				.returning()
				.then(rows => rows[0]);

			if (!account) {
				throw new Error("Failed get the account after insertion");
			}

			const identifier = await tx.insert(identifiers)
				.values({
					type: IDENTIFIER_TYPE.email,
					accountID: account.id,
					value: data.email
				})
				.returning()
				.then(rows => rows[0]);

			if (!identifier) {
				throw new Error(format("Failed to insert the email for account %s", [account.id]));
			}

			return {
				...account,
				email: identifier.value,
			} as AccountWithEmail;
		});
		return E.right(result);
	} catch (error) {
		return E.left(error);
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
		return E.left(error);
	}
}

/**
 * @throws {NoRecordError} in case the account not found
 * @param id
 */
async function fromID(id: string): Promise<E.Either<Account, Error>> {
	try {
		return await useTransaction(async tx => {
			const account = await tx
				.select()
				.from(accounts)
				.where(eq(accounts.id, id))
				.then(rows => rows.at(0))

			if (!account) {
				return E.left(NoRecordError);
			} else {
				const preferences = PreferencesSchema.parse(account.preferences);
				return E.right(Object.assign(account, {preferences}));
			}
		})
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
			}

			const preferences = PreferencesSchema.parse(account.preferences);
			return E.right(Object.assign(account, {preferences}));
		});
	} catch (error) {
		return E.left(error);
	}
}

async function verifyPassword(password: string, hash: string): Promise<E.Either<boolean, Error>> {
	return verify(hash, password, {
		timeCost: TIME_COST
	}).then(E.right, E.left);
}

async function getAvailableWorkspace(accountID: string): Promise<E.Either<WorkspaceWithMember, Error>> {
	try {
		return useTransaction(async tx => {
			const account = await tx
				.select({preferences: accounts.preferences})
				.from(accounts)
				.where(eq(accounts.id, accountID))
				.then(rows => rows.at(0));

			if (!account) {
				return E.left(NoRecordError);
			}

			const preferences = PreferencesSchema.parse(account.preferences);

			const workspace = await tx
				.selectDistinctOn([workspaces.id], {
					...getTableColumns(workspaces),
					membership: getTableColumns(memberships)
				})
				.from(workspaces)
				.innerJoin(memberships, eq(memberships.workspaceID, workspaces.id))
				.where(and(
					eq(memberships.accountID, accountID),
					eq(workspaces.id, preferences.lastUsedWorkspace!).if(!!preferences.lastUsedWorkspace)
				))
				.then(rows => rows.at(0));


			if (!workspace) {
				return E.left(NoRecordError);
			} else {
				return E.right(workspace);
			}
		});
	} catch (error) {
		return E.left(error);
	}
}




export const AccountStore = {
	createEmailAccount,
	fromID,
	fromIdentifier,
	identifierExists,
	verifyPassword,
	getAvailableWorkspace
};

