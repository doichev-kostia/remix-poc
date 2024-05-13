import { createAppStateCookie, requireAccount } from "~/app/auth.js";
import { type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { z } from "zod";
import { newFormError } from "~/app/.server/validation.js";
import { STATUS_CODE } from "~/app/http.js";
import { type Cuid, type SafeSlug, WorkspaceStore } from "~/internal/store/workspace.js";
import * as E from "effect/Either";
import { DuplicateError } from "~/internal/store/errors.js";
import { logger } from "~/app/.server/logger.js";
import { produce } from "immer";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Header } from "~/app/routes/join/Header.js";
import { AppStateContext } from "~/app/app-state.js";
import { Label } from "~/app/ui/label.js";
import { Input } from "~/app/ui/input.js";
import { cn } from "~/app/lib/utils.js";
import React from "react";
import { Button } from "~/app/ui/button.js";

export const meta = () => {
	return [{
		title: "Create workspace"
	}];
};

export async function loader({request}: LoaderFunctionArgs) {
	const state = await requireAccount(request);

	return json({
		state
	});
}

const ValidationSchema = z.object({
	slug: z.string()
		.trim()
		.toLowerCase()
		.min(3)
		.regex(/^[a-z0-9\-_]+$/),
});

type Values = z.infer<typeof ValidationSchema>;

export async function action({request}: ActionFunctionArgs) {
	let appState = await requireAccount(request);
	const data = await request.formData();
	const parsed = ValidationSchema.safeParse(Object.fromEntries(data));

	if (!parsed.success) {
		return json(newFormError(parsed.error), {status: STATUS_CODE.badRequest});
	}

	const values = parsed.data as {
		slug: SafeSlug;
	};

	const workspace = await WorkspaceStore.create({
		slug: values.slug,
	});

	if (E.isLeft(workspace)) {
		if (workspace.left === DuplicateError) {
			return json(newFormError(new Error("This name already exists")), {status: STATUS_CODE.badRequest});
		} else {
			logger.error(workspace.left, "Create workspace action: failed to create workspace");
			return json(newFormError(new Error("Internal Error")), {status: STATUS_CODE.internalServerError});
		}
	}

	const workspaceID = workspace.right.id;

	const membership = await WorkspaceStore.attachMembership(workspaceID, {
		accountID: appState.currentAccountID as Cuid,
	});

	if (E.isLeft(membership)) {
		logger.error(membership.left, "Create workspace action: failed to attach membership");
		return json(newFormError(new Error("Internal Error")), {status: STATUS_CODE.internalServerError});
	}

	const accountID = appState.currentAccountID;
	const membershipID = membership.right.id;
	const workspaceSlug = workspace.right.slug;

	appState = produce(appState, (draft) => {
		draft.currentMemberID = membershipID;
		draft.accounts[accountID].memberships[membershipID] = {
			id: membershipID,
			type: membership.right.type,
			workspace: {
				id: workspaceID,
				slug: workspaceSlug
			},
		};
	});

	const headers = new Headers();
	headers.append("Set-Cookie", await createAppStateCookie(appState));

	return redirect(`/${workspaceSlug}`, {
		headers,
	});
}

function CreateWorkspacePage() {
	const {state} = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	let errors = new Map<string, string>();

	if (actionData?.fieldErrors) {
		errors = new Map<string, string>(Object.entries(actionData.fieldErrors));
	}

	if (actionData?.formError) {
		console.error(actionData.formError);
	}

	return (
		<AppStateContext.Provider value={state}>
			<div className="flex flex-col h-full">
				<Header/>
				<main className="grow px-4">
					<section className="h-full flex justify-between w-full">
						<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
							<div className="text-center w-full mb-6">
								<h2 className="text-2xl tracking-tight text-foreground sm:text-4xl">
									Create a workspace
								</h2>
							</div>
							<div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
								<Form method="post" className="space-y-6">
									<div>
										<Label htmlFor="slug" className="block">
											Name
										</Label>
										<div className="mt-2">
											<Input
												data-error={errors.has("slug")}
												id="slug"
												name="slug"
												required
												className={cn("block w-full data-[error=true]:border-destructive")}
											/>
											<span className="text-muted-foreground text-sm">Needs to be lowercase, unique and URL friendly (a-z,-,_)</span>
											{errors.has("slug") && (
												<span className="text-destructive text-sm">{errors.get("slug")}</span>
											)}
										</div>
									</div>
									<div>
										<Button
											type="submit"
											className="w-full"
										>
											Create
										</Button>
									</div>
								</Form>
							</div>
						</div>
					</section>
				</main>
			</div>
		</AppStateContext.Provider>
	);
}

export default CreateWorkspacePage;
