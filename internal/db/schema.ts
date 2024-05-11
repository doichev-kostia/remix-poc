import {
	char,
	foreignKey,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	varchar
} from "drizzle-orm/pg-core";
import { castToEnum, cuid, id, timestamps, workspaceID } from "~/internal/db/sql.js";
import type { ValueOf } from "type-fest";

export const accounts = pgTable("accounts", {
	...id,
	...timestamps,
	firstName: varchar("first_name", {length: 255}).notNull(),
	lastName: varchar("last_name", {length: 255}).notNull(),
	primaryEmail: varchar("primary_email", { length: 255 }).notNull(), // ONLY EMAIL!
}, (table) => ({
	primaryEmailFK: foreignKey({ columns: [table.primaryEmail], foreignColumns: [identifiers.value] }).onUpdate("cascade").onDelete("restrict")
}));

export const IDENTIFIER_TYPE = {
	email: "email",
	oauthGoogle: "oauth_google",
	oauthGitHub: "oauth_github",
} as const;

export type IdentifierType = ValueOf<typeof IDENTIFIER_TYPE>

export const identifierTypeEnum = pgEnum("identifier_type", castToEnum(IDENTIFIER_TYPE));

export const identifiers = pgTable("identifiers", {
	...timestamps,
	type: identifierTypeEnum("type").notNull(),
	value: text("value").notNull(),
	accountID: cuid("account_id").notNull(),
}, (table) => ({
	pk: primaryKey({columns: [table.type, table.value]}),
	accountFK: foreignKey({columns: [table.accountID], foreignColumns: [accounts.id]}).onDelete("cascade"),
	accountIdx: index("idx_identifiers_account_id").on(table.accountID),
}));

export const workspaces = pgTable("workspaces", {
	...id,
	...timestamps,
	slug: varchar("name", {length: 255}).notNull(),
}, (table) => ({
	slugIdx: uniqueIndex("idx_workspaces_slug").on(table.slug)
}));

export const MEMBERSHIP_TYPE = {
	admin: "admin",
	regular: "regular"
} as const;

export type MembershipType = ValueOf<typeof MEMBERSHIP_TYPE>;

export const membershipTypeEnum = pgEnum("membership_type", castToEnum(MEMBERSHIP_TYPE));

export const memberships = pgTable("memberships", {
	...workspaceID,
	...timestamps,
	type: membershipTypeEnum("type").notNull().default("regular"),
	accountID: cuid("account_id"), // NULL in case of an invite
}, (table) => ({
	pk: primaryKey({columns: [table.id, table.workspaceID]}),
	workspaceFK: foreignKey({columns: [table.workspaceID], foreignColumns: [workspaces.id]}),
	accountFK: foreignKey({columns: [table.accountID], foreignColumns: [accounts.id]}),
}));

export const INVITE_STATUS = {
	pending: "pending",
	accepted: "accepted",
	expired: "expired"
} as const;

export type InviteStatus = ValueOf<typeof INVITE_STATUS>;
export const inviteStatusEnum = pgEnum("invite_status", castToEnum(INVITE_STATUS))

export const invites = pgTable("invites", {
	...timestamps,
	token: varchar("token", {length: 255}).unique().notNull(),
	status: inviteStatusEnum("status").notNull().default("pending"),
	expireTime: timestamp("expire_time").notNull(),
	email: varchar("email", {length: 255}).notNull(),
	workspaceID: cuid("workspace_id").notNull(),
	membershipID: cuid("membership_id").notNull(),
}, (table) => ({
	pk: primaryKey({columns: [table.membershipID, table.workspaceID]}),
	membershipFK: foreignKey({columns: [table.membershipID], foreignColumns: [memberships.id]}).onDelete("cascade"),
	workspaceFK: foreignKey({columns: [table.workspaceID], foreignColumns: [workspaces.id]}).onDelete("cascade"),
	expireTimeIdx: index("idx_invites_expire_time").on(table.expireTime),
	emailIdx: index("idx_invites_email").on(table.email),
	tokenIdx: uniqueIndex("idx_invites_token").on(table.token)
}));

const ISSUE_STATUS = {
	backlog: "backlog",
	progress: "progress",
	done: "done"
} as const;

export type IssueStatus = ValueOf<typeof ISSUE_STATUS>;

export const issueStatusEnum = pgEnum("issue_status", castToEnum(ISSUE_STATUS));

export const issues = pgTable("issues", {
	...workspaceID,
	...timestamps,
	number: integer("number").notNull(),
	title: varchar("title", {length: 255}).notNull(),
	description: text("description").notNull(),
	status: issueStatusEnum("status").notNull().default("backlog")
}, (table) => ({
	pk: primaryKey({columns: [table.id, table.workspaceID]}),
	workspaceFK: foreignKey({columns: [table.workspaceID], foreignColumns: [workspaces.id]}),
	numberIdx: uniqueIndex("idx_issues_workspace_number").on(table.workspaceID, table.number),
}));

