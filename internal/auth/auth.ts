import type { Provider } from "./providers/provider.js";
import * as E from "effect/Either";
import { type Logger, noopLogger } from "~/internal/logger.js";
import { InvalidProvider, InvalidRedirectURI } from "~/internal/auth/errors.js";
import format from "quick-format-unescaped";
import { createCookie } from "@remix-run/node";
import { seconds } from "~/internal/time.js";
import type { BaseClient, TokenSet } from "openid-client";

export type Handler = (request: Request) => Promise<E.Either<Response, Error>>
export type SuccessHandler = (request: Request, redirectURI: string, params: {
	provider: string;
	client: BaseClient;
	tokenSet: TokenSet;
}) => Promise<E.Either<Response, Error>>;
export type Middleware = (request: Request, response: Response, next: () => Promise<void>) => Promise<E.Either<void, Error>>;

export interface Service {
	addProvider(name: string, provider: Provider): void;

	// path and Handler
	getHandlers(): Map<string, Handler>;

	// path and middlewares
	getMiddlewares(): Map<string, Middleware[]>;
}

export type AuthServiceConfig = {
	baseURL: URL;
	onSuccess: SuccessHandler;
	logger?: Logger;
};

const redirectCookie = createCookie("redirect_uri", {
	maxAge: 10 * seconds.minute,
	httpOnly: true,
	sameSite: "none",
});

const providerCookie = createCookie("provider", {
	maxAge: 10 * seconds.minute,
	httpOnly: true,
	sameSite: "none",
});

export function AuthService(options: AuthServiceConfig): Service {
	const logger = options.logger ?? noopLogger;
	// To properly resolve the relative references in the URL, the base should end with '/'
	// https://developer.mozilla.org/en-US/docs/Web/API/URL_API/Resolving_relative_references
	const base = new URL(options.baseURL);
	if (!base.pathname.endsWith("/")) {
		base.pathname += "/";
	}

	const providersMap = new Map<string, Provider>();

	function addProvider(name: string, provider: Provider) {
		providersMap.set(name, provider);
	}

	function getHandlers() {
		const handlerMap = new Map<string, Handler>();
		for (const [name, provider] of providersMap) {
			const authorizePath = `/${name}/authorize`;
			const callbackPath = `/${name}/callback`;

			handlerMap.set(authorizePath, provider.authorize(base));
			handlerMap.set(callbackPath, provider.callback(base, onSuccess));
		}

		return handlerMap;
	}

	function getMiddlewares() {
		const middlewares = new Map<string, Middleware[]>();
		const authorizePath = `/:provider/authorize`;

		middlewares.set(authorizePath, [authorizationMiddleware]);

		return middlewares;
	}

	async function authorizationMiddleware(request: Request, response: Response, next: () => Promise<void>): Promise<E.Either<void, Error>> {
		const segments = request.url.split("/");
		const provider = segments.at(-2); // [..., ':provider', 'authorize'];

		if (!provider) {
			return E.left(InvalidProvider);
		}

		const query = new URLSearchParams(request.url.split("?")[1]);
		const redirectURI = query.get("redirect_uri");

		if (!redirectURI) {
			return E.left(InvalidRedirectURI);
		}

		logger.info(format(`authoring the user via "%s" provider`, [provider]));

		response.headers.append("Set-Cookie", await redirectCookie.serialize(redirectURI));
		response.headers.append("Set-Cookie", await providerCookie.serialize(provider));

		await next();
		return E.right(undefined);
	}

	async function onSuccess(request: Request, params: { client: BaseClient, tokenSet: TokenSet }) {
		const provider = await providerCookie.parse(request.headers.get("Cookie"));
		const redirectURI = await redirectCookie.parse(request.headers.get("Cookie"));

		if (typeof provider !== "string") {
			return E.left(InvalidProvider);
		}

		if (typeof redirectURI !== "string") {
			return E.left(InvalidRedirectURI);
		}

		return await options.onSuccess(request, redirectURI, {
			provider: provider,
			...params,
		});
	}


	return {
		addProvider,
		getHandlers,
		getMiddlewares
	};
}

