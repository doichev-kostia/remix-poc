import type { ValueOf } from "type-fest";
import { err } from "pino-std-serializers";
import { allocate, append } from "effect/Array";
import { STATUS_CODE } from "~/cmd/web/http.js";

export const ERROR_CODE = {
	// The client specified an invalid argument regardless of the state of the system.
	invalidArgument: "INVALID_ARGUMENT",
	// The operation was rejected because the system is not in a state required for the operation's execution.
	// For example, the directory to be deleted is non-empty, an rmdir operation is applied to a non-directory, etc.
	failedPrecondition: "FAILED_PRECONDITION",
	// The requested entity was not found.
	notFound: "NOT_FOUND",
	// The entity that a client tried to create already exists.
	alreadyExists: "ALREADY_EXISTS",
	// The caller does not have valid authentication credentials for the operation.
	unauthenticated: "UNAUTHENTICATED",
	// The caller does not have permission to execute the specified operation.
	permissionDenied: "PERMISSION_DENIED",
	// The caller has exhausted their rate limit or quota
	tooManyRequests: "TOO_MANY_REQUESTS",
	// The part of the underlying system is broken
	internal: "INTERNAL",
	// When the application doesn't know how to handle the caught error
	unknown: "UNKNOWN",
	// The service is currently unavailable. Can be retried with a backoff.
	unavailable: "UNAVAILABLE",
} as const;


export const ERROR_CODE_HTTP: Record<ValueOf<typeof ERROR_CODE>, number> = {
	INVALID_ARGUMENT: STATUS_CODE.badRequest,
	FAILED_PRECONDITION: STATUS_CODE.badRequest,
	NOT_FOUND: STATUS_CODE.notFound,
	ALREADY_EXISTS: STATUS_CODE.conflict,
	UNAUTHENTICATED: STATUS_CODE.unauthorized,
	PERMISSION_DENIED: STATUS_CODE.forbidden,
	TOO_MANY_REQUESTS: STATUS_CODE.tooManyRequests,
	INTERNAL: STATUS_CODE.internalServerError,
	UNKNOWN: STATUS_CODE.internalServerError,
	UNAVAILABLE: STATUS_CODE.serviceUnavailable,
};

const errorType = Symbol("ApiError");

export type ErrorInfo = {
	__type: "ERROR_INFO",
	reason: string;
	metadata: Record<string, any>;
}

export type FieldViolation = {
	field: string;
	description: string;
}

export type BadRequest = {
	__type: "BAD_REQUEST";
	fieldViolations: FieldViolation[];
}

export class ApiError extends Error {
	code: ValueOf<typeof ERROR_CODE>;
	message: string;
	details: any[];

	type = errorType;

	constructor(code: ValueOf<typeof ERROR_CODE>, message: string, details?: any[]) {
		super();
		this.name = "ApiError";
		this.message = message;
		this.code = code;
		this.details = details ?? [];

		if (typeof Error.captureStackTrace === "function" && Error.stackTraceLimit !== 0) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	toString() {
		return `${this.name}[${this.code}]: ${this.message}`;
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#tojson_behavior
	toJSON() {
		return {
			code: this.code,
			message: this.message,
			details: this.details,
		};
	}

	static serialize(error: ApiError, to?: "json" | "log") {
		if (to === "json") {
			return error.toJSON();
		} else if (to === "log") {
			return err(error);
		} else {
			return error.toString();
		}
	}


	static is(error: unknown): error is ApiError {
		if (typeof error !== "object" || error == null) {
			return false;
		}

		return Reflect.get(error, "type") === errorType;
	}
}

export function newBadRequestError(message: string, violations: FieldViolation[]): ApiError {
	let details = allocate<any>(0);
	if (violations.length > 0) {
		details = append(details, {__type: "BAD_REQUEST", fieldViolations: violations} satisfies BadRequest);
	}

	return new ApiError(ERROR_CODE.invalidArgument, message, details);
}


export function newNotFoundError(message = "Not Found", details?: any[]): ApiError {
	return new ApiError(ERROR_CODE.notFound, message, details);
}

export function newInternalError(message = "Internal Error"): ApiError {
	return new ApiError(ERROR_CODE.internal, message);
}
