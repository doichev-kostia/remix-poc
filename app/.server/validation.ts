import { ZodError } from "zod";

export function newFormValidationError(error: Error): { formError: string; fieldErrors: Record<string, string>} {
	if (!(error instanceof ZodError)) {
		return {
			formError: error.message,
			fieldErrors: {}
		}
	}

	// I hope this is more efficient than constantly expanding the object ( object[key] = value )
	const fieldErrors = new Map<string, string>();
	for (const field in error.formErrors.fieldErrors) {
		const value = error.formErrors.fieldErrors[field];
		fieldErrors.set(field, value?.at(0) ?? "");
	}

	return {
		formError: error.formErrors.formErrors.join(". "),
		fieldErrors: Object.fromEntries(fieldErrors),
	}
}
