import { useTransaction } from "~/internal/db/transaction.js";
import * as E from "effect/Either";
import { MEMBERSHIP_TYPE, memberships, type MembershipType, workspaces } from "~/internal/db/schema.js";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { DuplicateError, NoRecordError } from "~/internal/store/errors.js";
import type { Brand } from "effect/Brand";
import { createId } from "@paralleldrive/cuid2";

export type Cuid = string & Brand<"Cuid">;
export type SafeSlug = string & Brand<"SafeSlug">


export type Workspace = typeof workspaces.$inferSelect;
export type Membership = typeof memberships.$inferSelect

export type WorkspaceWithMember = Workspace & {
	membership: Membership
}

type WorkspaceData = {
	id?: Cuid,
	slug: SafeSlug;

}

/**
 * @throws {DuplicateError} in case the workspace with slug already exists
 * @param data
 */
async function create(data: WorkspaceData): Promise<E.Either<Workspace, Error>> {
	try {
		return await useTransaction(async tx => {
			const duplicate = (await exists({slug: data.slug})).pipe(E.getOrThrow);

			if (duplicate) {
				throw DuplicateError;
			}


			const record = await tx
				.insert(workspaces)
				.values({
					id: data.id || createId(),
					slug: data.slug,
				})
				.returning()
				.then(rows => rows[0]);

			if (!record) {
				throw new Error("Failed to get the workspace after insertion");
			}

			return E.right(record);
		});
	} catch (error) {
		return E.left(error);
	}
}

type MembershipData = {
	id?: Cuid,
	type?: MembershipType;
	accountID?: Cuid; // optional in case of an invite
};

async function attachMembership(workspaceID: string, {id, type = MEMBERSHIP_TYPE.regular, accountID}: MembershipData) : Promise<E.Either<Membership, Error>>{
	try {
		return await useTransaction(async tx => {
			// Maybe I should check for duplicates?
			const record = await tx
				.insert(memberships)
				.values({
					id: id ?? createId(),
					workspaceID: workspaceID,
					type: type,
					accountID: accountID
				})
				.returning()
				.then(rows => rows.at(0));

			if (!record) {
				throw new Error("Failed to get the membership after insertion");
			}

			return E.right(record);
		});
	} catch (error) {
		return E.left(error);
	}
}

async function fromAccount(accountID: string): Promise<E.Either<WorkspaceWithMember[], Error>> {
	try {
		const result = await useTransaction(async tx => {
			const rows = tx
				.selectDistinctOn([workspaces.id], {
					...getTableColumns(workspaces),
					membership: getTableColumns(memberships)
				})
				.from(workspaces)
				.innerJoin(memberships, eq(memberships.workspaceID, workspaces.id))
				.where(eq(memberships.accountID, accountID));


			return rows;
		});

		return E.right(result);
	} catch (error) {
		return E.left(error);
	}
}

async function fromID(id: string): Promise<E.Either<Workspace, Error>> {
	try {
		return await useTransaction(async tx => {
			const row = await tx
				.select()
				.from(workspaces)
				.where(eq(workspaces.id, id))
				.then(rows => rows.at(0));

			if (!row) {
				return E.left(NoRecordError);
			} else {
				return E.right(row);
			}
		});
	} catch (error) {
		return E.left(error);
	}
}

async function fromSlug(slug: string): Promise<E.Either<Workspace, Error>> {
	try {
		return await useTransaction(async tx => {
			const row = await tx
				.select()
				.from(workspaces)
				.where(eq(workspaces.slug, slug))
				.then(rows => rows.at(0));

			if (!row) {
				return E.left(NoRecordError);
			} else {
				return E.right(row);
			}
		});
	} catch (error) {
		return E.left(error);
	}
}

async function exists(filter: { slug?: string, id?: string }): Promise<E.Either<boolean, Error>> {
	try {
		return await useTransaction(async tx => {
			if (!filter.slug && !filter.id) {
				throw new Error("Either slug or id must be provided to check if the workspace exists");
			}

			const exists = await tx
				.select({
					count: sql<number>`cast(count(*) as int)`
				})
				.from(workspaces)
				.where(and(
					eq(workspaces.slug, filter.slug!).if(!!filter.slug),
					eq(workspaces.id, filter.id!).if(!!filter.id)
				))
				.then(rows => rows[0].count > 0);

			return E.right(exists);
		});
	} catch (error) {
		return E.left(error);
	}
}


export const WorkspaceStore = {
	create,
	exists,
	fromID,
	fromAccount,

	attachMembership
};
