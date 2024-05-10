import { redirect, } from "@remix-run/node";
import { STATUS_CODE } from "~/cmd/web/http.js";

/**
 * @throws {import("@remix-run/node").TypedResponse<never>} in case there is no token
 * @param request
 */
export function requireUser(request: Request) {
	const token = request.headers.get("Cookie") // TODO: parse the cookie

	if (!token) {
		throw redirect("/sign-in", {
			status: STATUS_CODE.unauthorized
		})
	}

	return token;
}
