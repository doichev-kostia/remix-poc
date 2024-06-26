import React from "react";
import { Label } from "~/app/ui/label.js";
import { Input } from "~/app/ui/input.js";
import { Button } from "~/app/ui/button.js";
import { Form, useActionData } from "@remix-run/react";
import { type ActionFunctionArgs, json, redirect, type TypedResponse } from "@remix-run/node";
import { cn } from "~/app/lib/utils.js";
import { z } from "zod";
import { newFormError } from "~/app/.server/validation.js";
import { STATUS_CODE } from "~/app/http.js";
import { AccountStore } from "~/internal/store/account.js";
import { IDENTIFIER_TYPE } from "~/internal/db/schema.js";

import * as E from "effect/Either";
import * as O from "effect/Option";
import { NoRecordError } from "~/internal/store/errors.js";
import { logger } from "~/app/.server/logger.js";
import {
	type AppState,
	createAppStateCookie,
	createAuthCookie,
	createJWT,
	parseAppStateCookie,
	parseAuthCookie
} from "~/app/auth.js";

const PASSWORD_MIN_LENGTH = 8;

export const meta = () => {
	return [{
		title: "Sign in"
	}];
};

const ValidationSchema  = z.object({
	email: z.string().email(),
	password: z.string().min(PASSWORD_MIN_LENGTH)
});

type Values = z.infer<typeof ValidationSchema>;


export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<{
	formError: string;
	fieldErrors: Record<string, string>
}>>{
	const data = await request.formData();
	const parsed = ValidationSchema.safeParse(Object.fromEntries(data));
	if (!parsed.success) {
		return json(newFormError(parsed.error), {
			status: STATUS_CODE.badRequest
		});
	}

	const values = parsed.data;

	const account = await AccountStore.fromIdentifier(IDENTIFIER_TYPE.email, values.email);

	if (E.isLeft(account)) {
		if (account.left === NoRecordError) {
			return json(newFormError(new Error("Invalid credentials")), {
				status: STATUS_CODE.badRequest
			})
		} else {
			logger.error(account.left, "Sign in: failed to find the account by identifier")
			return json(newFormError(new Error("Internal Error")), {
				status: STATUS_CODE.internalServerError,
			});
		}
	}

	if (!account.right.password) {
		return json(newFormError(new Error("Invalid credentials")), {
			status: STATUS_CODE.badRequest
		})
	}

	const validPassword = await AccountStore.verifyPassword(values.password, account.right.password);

	if (E.isLeft(validPassword)) {
		logger.error(validPassword.left, "Sign in: failed to verify the password")
		return json(newFormError(new Error("Internal Error")), {
			status: STATUS_CODE.internalServerError,
		});
	} else if (validPassword.right === false) {
		return json(newFormError(new Error("Invalid credentials")), {
			status: STATUS_CODE.badRequest
		})
	}

	const accountID = account.right.id;

	const token = await createJWT({
		type: "account",
		properties: {
			accountID
		}
	});

	const currentAuth = await parseAuthCookie(request.headers).then(O.getOrElse(() => ({})));
	currentAuth[accountID] = token
	const authCookie = await createAuthCookie(currentAuth);

	const appState = await parseAppStateCookie(request.headers).then(O.getOrElse(() => ({
		currentAccountID: "",
		currentMemberID: "",
		accounts: {},
	}) as AppState))

	appState.currentMemberID = "";
	appState.currentAccountID = accountID;
	appState.accounts[accountID] = {
		id: accountID,
		displayName: account.right.firstName + " " + account.right.lastName,
		memberships: {},
	}

	const workspace = await AccountStore.getAvailableWorkspace(accountID);
	if (E.isLeft(workspace)) {
		if (workspace.left === NoRecordError) {
			const headers = new Headers();
			const stateCookie = await createAppStateCookie(appState);

			headers.append("Set-Cookie", authCookie);
			headers.append("Set-Cookie", stateCookie);

			return redirect("/join", {
				headers
			});
		} else {
			logger.error(workspace.left, "Sign in: failed to get the available workspace")
			return json(newFormError(new Error("Internal Error")), {
				status: STATUS_CODE.internalServerError,
			});
		}
	}

	const workspaceID = workspace.right.id;
	const workspaceSlug = workspace.right.slug;
	const membership = workspace.right.membership;

	appState.accounts[accountID].memberships[membership.id] = {
		id: membership.id,
		type: membership.type,
		workspace: {
			id: workspaceID,
			slug: workspaceSlug
		}
	}

	const headers = new Headers();
	const stateCookie = await createAppStateCookie(appState);

	headers.append("Set-Cookie", authCookie);
	headers.append("Set-Cookie", stateCookie);

	return redirect(`/${workspaceSlug}`, {
		headers
	})
}

function SignInPage() {
	const actionData = useActionData<typeof action>();
	let errors = new Map<string, string>();

	if (actionData?.fieldErrors) {
		errors = new Map<string, string>(Object.entries(actionData.fieldErrors))
	}

	if (actionData?.formError) {
		console.error(actionData.formError)
	}

	return (
		<div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
			<div className="sm:mx-auto sm:w-full sm:max-w-sm">
				<img
					className="mx-auto h-10 w-auto"
					src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
					alt="Your Company"
				/>
				<h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
					Sign in to your account
				</h2>
			</div>

			<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
				<Form method={"post"} className="space-y-6">
					<div>
						<Label htmlFor="email" className="block">
							Email address
						</Label>
						<div className="mt-2">
							<Input
								data-error={errors.has("email")}
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className={cn("block w-full data-[error=true]:border-destructive")}
							/>
							{errors.has("email") && (
								<span className="text-destructive text-sm">{errors.get("email")}</span>
							)}

						</div>
					</div>

					<div>
						<div className="flex items-center justify-between">
							<Label htmlFor="password" className="block">
								Password
							</Label>
							<div className="text-sm">
								<a href="#" className="font-semibold text-indigo-600 hover:text-indigo-500">
									Forgot password?
								</a>
							</div>
						</div>
						<div className="mt-2">
							<Input
								data-error={errors.has("password")}
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								className="block w-full data-[error=true]:border-destructive"
								// minLength={PASSWORD_MIN_LENGTH}
							/>
							{errors.has("password") && (
								<span className="text-destructive text-sm">{errors.get("password")}</span>
							)}
						</div>
					</div>

					<div>
						<Button
							type="submit"
							className="w-full"
						>
							Sign in
						</Button>
					</div>
				</Form>

				<p className="mt-10 text-center text-sm text-gray-500">
					Not a member?{" "}
					<a href="/sign-up" className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
						Sign up
					</a>
				</p>
			</div>
		</div>
	);
}

export default SignInPage;
