import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { z } from "zod";
import { STATUS_CODE } from "~/app/http.js";
import { AccountStore } from "~/internal/store/account.js";
import * as E from "effect/Either";
import { NoRecordError } from "~/internal/store/errors.js";
import { logger } from "~/app/.server/logger.js";
import { createAppStateCookie, requireAccount } from "~/app/auth.js";
import { produce } from "immer";
import { newFormError } from "~/app/.server/validation.js";

export async function action({ request }: ActionFunctionArgs) {
	let state = await requireAccount(request);
	const data = await request.formData();
	const parsed = z.string().cuid2().safeParse(data.get("account"));
	if (!parsed.success) {
		return json({error: "Invalid id"}, { status: STATUS_CODE.badRequest })
	}

	const accountID = parsed.data;
	if (!state.accounts[accountID]) {
		return json({error: "Invalid id"}, { status: STATUS_CODE.badRequest })
	}

	const account = await AccountStore.fromID(accountID);

	if (E.isLeft(account)) {
		if (account.left === NoRecordError) {
			return json({ error: "Not found" }, { status: STATUS_CODE.notFound })
		} else {
			logger.error(account.left, "Switch account action: failed to get the account");
			return json({ error: "Internal Error" }, { status: STATUS_CODE.internalServerError });
		}
	}

	state = produce(state, (draft) => {
		draft.currentAccountID = accountID;
		draft.currentMemberID = ""
	});


	const workspace = await AccountStore.getAvailableWorkspace(accountID)
	if (E.isLeft(workspace)) {
		if (workspace.left === NoRecordError) {
			const headers = new Headers();
			const stateCookie = await createAppStateCookie(state);

			headers.append("Set-Cookie", stateCookie);
			return redirect("/join", {
				headers,
			})
		} else {
			logger.error(workspace.left, "Switch account action: failed to get the available workspace")
			return json(newFormError(new Error("Internal Error")), {
				status: STATUS_CODE.internalServerError,
			});
		}
	}

	const workspaceID = workspace.right.id;
	const workspaceSlug = workspace.right.slug;
	const membership = workspace.right.membership;

	state = produce(state, (draft) => {
		draft.currentMemberID = membership.id
		draft.accounts[accountID].memberships[membership.id] = {
			id: membership.id,
			type: membership.type,
			workspace: {
				id: workspaceID,
				slug: workspaceSlug
			}
		}
	});

	const headers = new Headers();
	const stateCookie = await createAppStateCookie(state);

	headers.append("Set-Cookie", stateCookie);

	return new Response(null, {
		status: STATUS_CODE.noContent,
		headers,
	});
}
