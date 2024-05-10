import React from "react";
import { Label } from "~/app/ui/label.js";
import { Input } from "~/app/ui/input.js";
import { Button } from "~/app/ui/button.js";
import { Form, useActionData } from "@remix-run/react";
import { type ActionFunctionArgs, json, redirect, type TypedResponse } from "@remix-run/node";
import { cn } from "~/app/lib/utils.js";
import { z } from "zod";
import { newFormValidationError } from "~/app/.server/validation.js";
import { STATUS_CODE } from "~/cmd/web/http.js";

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
	const parsed = ValidationSchema.safeParse(data);
	if (!parsed.success) {
		return json(newFormValidationError(parsed.error), {
			status: STATUS_CODE.badRequest
		});
	}

	return redirect("/workspace")
}

function SignInPage() {
	const actionData = useActionData<typeof action>();
	let errors = new Map<string, string>();

	if (actionData?.fieldErrors) {
		errors = new Map<string, string>(Object.entries(actionData.fieldErrors))
	}

	if (actionData?.formError) {
		// TODO: show a toast or something
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
