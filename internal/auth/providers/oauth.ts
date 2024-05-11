import { generators, Issuer } from "openid-client";
import type { Handler } from "../auth.js";
import type { Provider, SuccessHandler } from "./provider.js";
import { STATUS_CODE } from "~/cmd/web/http.js";
import { createCookie } from "@remix-run/node";
import { seconds } from "~/internal/time.js";
import * as E from "effect/Either";

export type OauthBasicConfig = {
	clientID: string;
	clientSecret: string;
	scope: string;
	prompt?: string; // whether users will be prompted for re-authentication and consent
	parameters?: Record<string, string>
};

export type OauthConfig = OauthBasicConfig & {
	issuer: Issuer
}

const codeVerifierCookie = createCookie("auth_code_verifier", {
	maxAge: 10 * seconds.minute,
	httpOnly: true,
	sameSite: "none",
});

const stateCookie = createCookie("auth_state", {
	maxAge: 10 * seconds.minute,
	httpOnly: true,
	sameSite: "none",
});

export function OauthProvider(config: OauthConfig): Provider {
	function getCallbackURL(baseURL: URL) {
		// To properly resolve the relative references in the URL, the base should end with '/'
		// https://developer.mozilla.org/en-US/docs/Web/API/URL_API/Resolving_relative_references
		const base = new URL(baseURL);
		if (!base.pathname.endsWith("/")) {
			base.pathname += "/";
		}

		return new URL("./callback", base);
	}

	function getClient(callbackPath: string) {
		const client = new config.issuer.Client({
			client_id: config.clientID,
			client_secret: config.clientSecret,
			redirect_uris: [callbackPath],
			response_types: ["code"],
		});
		return client;
	}


	function authorize(baseURL: URL): Handler {
		return async function authorizeHandler(request) {
			try {
				const callbackURL = getCallbackURL(baseURL);
				const client = getClient(callbackURL.pathname);

				const codeVerifier = generators.codeVerifier();
				const state = generators.state();
				const codeChallenge = generators.codeChallenge(codeVerifier);

				const url = client.authorizationUrl({
					scope: config.scope,
					code_challenge: codeChallenge,
					code_challenge_method: "S256",
					state: state,
					prompt: config.prompt,
					...config.parameters
				});

				const headers = new Headers();
				headers.set("Location", url);
				headers.append("Set-Cookie", await codeVerifierCookie.serialize(codeVerifier));
				headers.append("Set-Cookie", await stateCookie.serialize(state));

				return E.right(new Response(null, {
					status: STATUS_CODE.found,
					headers: headers,
				}));
			} catch (error) {
				return E.left(error);
			}
		};
	}

	function callback(baseURL: URL, onSuccess: SuccessHandler): Handler {
		return async function callbackHandler(request) {
			try {
				const callbackURL = getCallbackURL(baseURL);
				const client = getClient(callbackURL.pathname);

				const query = new URLSearchParams(request.url.split("?")[1]);
				if (query.has("error")) {
					return E.left(new Error(query.get("error")!));
				}

				const codeVerifier = await codeVerifierCookie.parse(request.headers.get("Cookie"));
				const state = await stateCookie.parse(request.headers.get("Cookie"));

				const tokenSet = await client.oauthCallback(callbackURL.pathname, Object.fromEntries(query), {
					code_verifier: codeVerifier,
					state: state,
				});

				return await onSuccess(request, {client, tokenSet});
			} catch (error) {
				return E.left(error);
			}
		};
	}


	return {
		authorize,
		callback
	};
}
