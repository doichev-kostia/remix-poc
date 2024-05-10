import React from "react";
import { Label } from "~/app/ui/label.js";
import { Input } from "~/app/ui/input.js";
import { Button } from "~/app/ui/button.js";
import { Form, useActionData } from "@remix-run/react";
import { type ActionFunctionArgs, json, redirect, type TypedResponse } from "@remix-run/node";
import { cn } from "~/app/lib/utils.js";
import { type NonExistingIdentifier, UserRepository, type ValidPassword } from "~/internal/repositories/user/user.js";
import { IDENTIFIER_TYPE } from "~/internal/db/schema.js";
import * as E from "effect/Either";
import { z } from "zod";
import { STATUS_CODE } from "~/cmd/web/http.js";
import { newFormValidationError } from "~/app/.server/validation.js";

const PASSWORD_MIN_LENGTH = 8;
const NAME_MIN_LENGTH = 2;

export const meta = () => {
	return [{
		title: "Sign up"
	}];
};

const ValidationSchema = z.object({
	firstName: z.string().min(NAME_MIN_LENGTH),
	lastName: z.string().min(NAME_MIN_LENGTH),
	email: z.string().email(),
	password: z.string().min(PASSWORD_MIN_LENGTH)
});

type Values = z.infer<typeof ValidationSchema>;

export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<{
	formError: string;
	fieldErrors: Record<string, string>
}>> {
	const data = await request.formData();
	const parsed = ValidationSchema.safeParse(Object.fromEntries(data));

	if (!parsed.success) {
		return json(newFormValidationError(parsed.error), {
			status: STATUS_CODE.badRequest
		});
	}

	const values = parsed.data as Values & {
		password: ValidPassword;
	};

	const exists = await UserRepository.identifierExists(IDENTIFIER_TYPE.email, values.email);

	if (E.isLeft(exists)) {
		return json({formError: "Internal Error", fieldErrors: {}}, {
			status: STATUS_CODE.internalServerError,
		});
	}

	if (exists.right) {
		return json({formError: "", fieldErrors: {email: "email already exists"}}, {
			status: STATUS_CODE.conflict
		});
	}

	const user = await UserRepository.createUser({
		firstName: values.firstName,
		lastName: values.lastName,
		password: values.password,
		identifier: {
			type: IDENTIFIER_TYPE.email,
			value: values.email as NonExistingIdentifier,
		}
	});

	if (E.isLeft(user)) {
		return json({formError: "Internal Error", fieldErrors: {}}, {
			status: STATUS_CODE.internalServerError,
		});
	}

	return redirect("/");
}

function SignUpPage() {
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
					Create your account
				</h2>
			</div>

			<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
				<Form method="POST" className="space-y-6">
					<div>
						<Label htmlFor="firstName" className="block">
							First name
						</Label>
						<div className="mt-2">
							<Input
								data-error={errors.has("firstName")}
								id="firstName"
								name="firstName"
								autoComplete="given-name"
								required
								minLength={NAME_MIN_LENGTH}
								className={cn("block w-full data-[error=true]:border-destructive")}
							/>
							{errors.has("firstName") && (
								<span className="text-destructive text-sm">{errors.get("firstName")}</span>
							)}

						</div>
					</div>

					<div>
						<Label htmlFor="lastName" className="block">
							Last name
						</Label>
						<div className="mt-2">
							<Input
								data-error={errors.has("lastName")}
								id="lastName"
								name="lastName"
								autoComplete="family-name"
								required
								minLength={NAME_MIN_LENGTH}
								className={cn("block w-full data-[error=true]:border-destructive")}
							/>
							{errors.has("lastName") && (
								<span className="text-destructive text-sm">{errors.get("lastName")}</span>
							)}

						</div>
					</div>

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
								minLength={PASSWORD_MIN_LENGTH}
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
							Sign up
						</Button>
					</div>
				</Form>

				<p className="mt-10 text-center text-sm text-gray-500">
					Already have an account?{" "}
					<a href="/sign-in" className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
						Sign in
					</a>
				</p>
			</div>
		</div>
	);
}

export default SignUpPage;
