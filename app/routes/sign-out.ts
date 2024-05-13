import { type ActionFunctionArgs, redirect } from "@remix-run/node";
import {
	type AppState,
	createAppStateCookie,
	createAuthCookie,
	parseAppStateCookie,
	parseAuthCookie,
	removeAppStateCookie,
	removeAuthCookie
} from "~/app/auth.js";
import * as O from "effect/Option";
import assert from "node:assert";
import { db } from "~/internal/db/drizzle.js";
import { memberships, workspaces } from "~/internal/db/schema.js";
import { and, eq } from "drizzle-orm";
import { logger } from "~/app/.server/logger.js";

// Use the regular <form action="/logout" method="post"/> so it refreshes the page and clears all the things
export async function action({request}: ActionFunctionArgs) {
	const appState = await parseAppStateCookie(request.headers);

	// Doesn't matter if the auth is correct, no app state – impossible to go further
	if (O.isNone(appState)) {
		const headers = new Headers();
		headers.append("Set-Cookie", await removeAuthCookie());
		headers.append("Set-Cookie", await removeAppStateCookie());
		throw redirect("/sign-in", {
			headers
		});
	}

	const accountID = appState.value.currentAccountID;

	const auth = await parseAuthCookie(request.headers);

	if (O.isNone(auth) || Object.keys(auth.value).length < 2 || !(accountID in auth.value)) {
		const headers = new Headers();
		headers.append("Set-Cookie", await removeAuthCookie());
		headers.append("Set-Cookie", await removeAppStateCookie());
		throw redirect("/sign-in", {
			headers,
		});
	}

	delete auth[accountID];
	delete appState.value.accounts[accountID];

	let anotherAccountID: string | undefined = undefined;
	for (const id in appState.value.accounts) {
		if (anotherAccountID) {
			break;
		}
		if (id === accountID) continue;

		anotherAccountID = id;
	}

	// impossible case
	assert.ok(anotherAccountID, "Sign out: An impossible cased detected! Account ID must be defined");

	// Having no active membership is fine, it's important to have an active account
	let anotherMembershipID = "";
	for (const id in appState.value.accounts[anotherAccountID].memberships) {
		if (anotherMembershipID) {
			break;
		}

		anotherMembershipID = id;
	}

	const newAppState: AppState = {
		...appState.value,
		currentAccountID: anotherAccountID,
		currentMemberID: anotherMembershipID,
	};

	const headers = new Headers();
	headers.append("Set-Cookie", await createAuthCookie(auth.value));
	headers.append("Set-Cookie", await createAppStateCookie(newAppState));

	if (newAppState.currentMemberID == "") {
		return redirect("/join", {
			headers
		});
	} else {
		const workspaceID = newAppState.accounts[newAppState.currentAccountID].memberships[newAppState.currentMemberID].workspace.id;

		const workspace = await db
			.select({id: workspaces.id, slug: workspaces.slug })
			.from(workspaces)
			.innerJoin(memberships, eq(memberships.workspaceID, workspaces.id))
			.where(and(
				eq(workspaces.id, workspaceID),
				eq(memberships.id, newAppState.currentMemberID),
				eq(memberships.accountID, newAppState.currentAccountID),
			)).then(rows => rows.at(0));


		if (!workspace) {
			logger.error(`Sign out: There is a mismatch between the state and db. The account "%s" has a membership "%s" in workspace "%s", while the database record doesn't exist`, newAppState.currentAccountID, newAppState.currentMemberID, workspaceID);
			const headers = new Headers();
			headers.append("Set-Cookie", await removeAuthCookie());
			headers.append("Set-Cookie", await removeAppStateCookie());
			throw redirect("/sign-in", {
				headers,
			});
		}

		return redirect(`/${workspace.slug}`, {
			headers
		})
	}

}
