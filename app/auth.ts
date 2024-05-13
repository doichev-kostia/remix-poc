import { type CookieSerializeOptions, createCookie, redirect, } from "@remix-run/node";
import { STATUS_CODE } from "~/app/http.js";
import { seconds } from "~/internal/time.js";
import { config } from "~/app/.server/config.js";
import { z } from "zod";
import * as O from "effect/Option";
import { jwtVerify, SignJWT } from "jose";

const authCookie = createCookie("auth", {
	path: '/',
	httpOnly: true,
	sameSite: "lax",
	maxAge: 365 * seconds.day,
	secure: config.secureCookies,
});

const appStateCookie = createCookie("app-state", {
	path: '/',
	httpOnly: false,
	sameSite: "lax",
	maxAge: 365 * seconds.day,
	secure: config.secureCookies,
});

/**
 *
 * @param value key-value pair of an account id and JWT
 */
export function createAuthCookie(value: Record<string, string>, options?: CookieSerializeOptions): Promise<string> {
	return authCookie.serialize(value, options)
}

export const CookieSchema = z.record(z.string());

export async function parseAuthCookie(headers: Headers): Promise<O.Option<Record<string, string>>> {
	const payload = await authCookie.parse(headers.get("Cookie")).then(O.some, O.none);

	if (O.isNone(payload)) {
		return O.none();
	}

	const parsed = CookieSchema.safeParse(payload.value);

	if (!parsed.success) {
		return O.none();
	} else {
		return O.some(parsed.data);
	}
}

export function removeAuthCookie(): Promise<string> {
	return authCookie.serialize("", {
		maxAge: 0
	})
}

export const AccountActorSchema = z.object({
	type: z.literal("account"),
	properties: z.object({
		accountID: z.string().cuid2(),
	})
})

export type AccountActor = z.infer<typeof AccountActorSchema>;

export const AppStateSchema = z.object({
	currentAccountID: z.string().cuid2(),
	currentMemberID: z.string(), // if no membership - ""
	accounts: z.record(z.object({
		id: z.string().cuid2(),
		displayName: z.string(),
		memberships: z.record(z.object({
			id: z.string().cuid2(),
			type: z.string(),
			workspace: z.object({
				id: z.string().cuid2(),
				slug: z.string()
			})
		}))
	})),
});

export type AppState = z.infer<typeof AppStateSchema>;

export async function createJWT(actor: AccountActor): Promise<string>  {
	const token = await new SignJWT(actor)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1y")
		.setIssuer(config.issuer)
		.sign(config.JWTSecret);

	return token;
}

export async function decodeJWT(token: string): Promise<O.Option<AccountActor>> {
	const result = await jwtVerify(token, config.JWTSecret).then(O.some, O.none);

	if (O.isNone(result)) {
		return O.none();
	}

	const parsed = AccountActorSchema.safeParse(result.value.payload);

	if (!parsed.success) {
		return O.none();
	} else {
		return O.some(parsed.data);
	}
}

export function createAppStateCookie(state: AppState, options?: CookieSerializeOptions): Promise<string> {
	return appStateCookie.serialize(state);
}

export async  function parseAppStateCookie(headers: Headers): Promise<O.Option<AppState>> {
	const payload = await appStateCookie.parse(headers.get("Cookie")).then(O.some, O.none);

	if (O.isNone(payload)) {
		return O.none();
	}

	const parsed = AppStateSchema.safeParse(payload.value);

	if (!parsed.success) {
		return O.none();
	} else {
		return O.some(parsed.data);
	}
}

export async function removeAppStateCookie(): Promise<string> {
	return appStateCookie.serialize("", {
		maxAge: 0
	})
}

/**
 * @throws {import("@remix-run/node").TypedResponse<never>} in case there is no token
 * @param request
 */
export async function requireAccount(request: Request): Promise<AppState> {
	const appState = await parseAppStateCookie(request.headers);

	// Even if the auth is correct, it's impossible to proceed without the app state
	if (O.isNone(appState)) {
		const headers = new Headers();
		headers.append("Set-Cookie", await removeAuthCookie());
		headers.append("Set-Cookie", await removeAppStateCookie());
		throw redirect("/sign-in", {
			headers
		})
	}

	const auth = await parseAuthCookie(request.headers);

	if (O.isNone(auth)) {
		const headers = new Headers();
		headers.append("Set-Cookie", await removeAuthCookie());
		headers.append("Set-Cookie", await removeAppStateCookie());
		throw redirect("/sign-in", {
			headers,
		})
	}

	const currentActorToken: string | undefined = auth.value[appState.value.currentAccountID];

	if (!currentActorToken) {
		const headers = new Headers();
		headers.append("Set-Cookie", await removeAuthCookie());
		headers.append("Set-Cookie", await removeAppStateCookie());
		throw redirect("/sign-in", {
			headers
		})
	}

	const currentActor = await decodeJWT(currentActorToken);

	if (O.isNone(currentActor)) {
		const headers = new Headers();
		headers.append("Set-Cookie", await removeAuthCookie());
		headers.append("Set-Cookie", await removeAppStateCookie());
		throw redirect("/sign-in", {
			headers
		})
	}

	return appState.value;
}
