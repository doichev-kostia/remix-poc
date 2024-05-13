import { removeAppStateCookie, removeAuthCookie, requireAccount } from "~/app/auth.js";
import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { db } from "~/internal/db/drizzle.js";
import { memberships, workspaces } from "~/internal/db/schema.js";
import { and, eq } from "drizzle-orm";
import { logger } from "~/app/.server/logger.js";

export async function loader({ request }: LoaderFunctionArgs) {
	const state = await requireAccount(request);

	if (state.currentMemberID == "") {
		return redirect("/join");
	} else {
		const workspaceID = state.accounts[state.currentAccountID].memberships[state.currentMemberID].workspace.id;

		const workspace = await db
			.select({id: workspaces.id, slug: workspaces.slug })
			.from(workspaces)
			.innerJoin(memberships, eq(memberships.workspaceID, workspaces.id))
			.where(and(
				eq(workspaces.id, workspaceID),
				eq(memberships.id, state.currentMemberID),
				eq(memberships.accountID, state.currentAccountID),
			)).then(rows => rows.at(0));


		if (!workspace) {
			logger.error(`Root loader: There is a mismatch between the state and db. The account "%s" has a membership "%s" in workspace "%s", while the database record doesn't exist`, state.currentAccountID, state.currentMemberID, workspaceID);
			const headers = new Headers();
			headers.append("Set-Cookie", await removeAuthCookie());
			headers.append("Set-Cookie", await removeAppStateCookie());
			throw redirect("/sign-in", {
				headers,
			});
		}

		return redirect(`${workspace.slug}`)
	}
}
