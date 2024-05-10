// import { ApiError, type BadRequest, ERROR_CODE, type ErrorInfo, type FieldViolation } from "~/cmd/web/error.js";
// import { ZodError } from "zod";
// import { allocate, append } from "effect/Array";
//

// export function toFieldViolations(fieldErrors: Record<string, string[] | undefined>): FieldViolation[] {
// 	return Object.keys(fieldErrors).map(field => {
// 		const err = fieldErrors[field]?.at(0) ?? "";
// 		return {
// 			field,
// 			description: err
// 		} satisfies FieldViolation
// 	})
// }
//
// export function newFormValidationError(error: Error): ApiError {
// 	if (!(error instanceof ZodError)) {
// 		return new ApiError(ERROR_CODE.invalidArgument, error.message);
// 	}
//
// 	const violations = toFieldViolations(error.formErrors.fieldErrors as Record<string, string[]>);
// 	const formError = error.formErrors.formErrors.join(".");
//
// 	let details = allocate<BadRequest | ErrorInfo>(0)
// 	if (violations.length > 0) {
// 		details = append(details, {__type: "BAD_REQUEST", fieldViolations: violations } satisfies BadRequest)
// 	}
//
// 	if (formError.length > 0) {
// 		details = append(details, {
// 			__type: "ERROR_INFO",
// 			reason: formError,
// 			metadata: {},
// 		} satisfies ErrorInfo)
// 	}
//
// 	return new ApiError(ERROR_CODE.invalidArgument, error.message, details);
// }
