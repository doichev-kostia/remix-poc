import * as path from "node:path";
import type { ServerBuild } from "@remix-run/server-runtime";
import { createRequestHandler } from "@remix-run/server-runtime";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

import { serveStatic } from "@hono/node-server/serve-static";
import { type HttpBindings, serve } from "@hono/node-server";
import { Match } from "effect";
import { AuthService } from "~/internal/auth/auth.js";
import * as E from "effect/Either";
import { STATUS_CODE } from "~/cmd/web/http.js";
import { importPKCS8, SignJWT } from "jose";
import { AccountStore, type NonExistingIdentifier } from "~/internal/store/account/account.js";
import { IDENTIFIER_TYPE, type IdentifierType } from "~/internal/db/schema.js";
import * as assert from "node:assert";
import { createCookie } from "@remix-run/node";
import { seconds } from "~/internal/time.js";
import { setCookie } from "undici";
import { GoogleProvider } from "~/internal/auth/providers/google.js";


let  {devServer, addr, mode, jwtPubkey, jwtPrivkey, issuer, url} = yargs(hideBin(process.argv))
	.option("dev-server", {
		type: "boolean",
		default: true,
	})
	.option("issuer", {
		type: "string",
		default: "remix-poc",
	})
	.option("url", {
		type: "string",
	})
	.option("addr", {
		type: "string",
		default: ":3000", // host:port
	})
	.option("mode", {
		type: "string", // "development" | "production" | ...
		default: "development"
	})
	.option("jwt-pubkey", {
		type: "string",
		default: "./keys/public.pem"
	})
	.option("jwt-privkey", {
		type: "string",
		default: "./keys/private.pem"
	})
	.parseSync();

const [hostname = "0.0.0.0", port] = addr.split(":");

if (!url) {
	url = `http://${hostname}:${port}`
}

const viteDevServer = devServer === true ? await import("vite").then((vite) =>
	vite.createServer({
		server: {middlewareMode: true},
	})
) : null;

type Bindings = HttpBindings;

type Env = { Bindings: Bindings };
const app = new Hono<Env>();

let staticServer: MiddlewareHandler;
if (viteDevServer) {
	staticServer = createMiddleware(async (ctx: Context<Env>, next) => {
		await new Promise((res) => {
			return viteDevServer.middlewares(ctx.env.incoming, ctx.env.outgoing, res);
		});
		await next();
	});
} else {
	staticServer = serveStatic({root: "./build/client"});
}

let build: ServerBuild | (() => Promise<ServerBuild>);
if (viteDevServer) {
	build = () => viteDevServer.ssrLoadModule("virtual:remix/server-build") as any;
} else {
	const srv = path.resolve("build/server/index.js");
	build = await import(srv);
}


const PROVIDERS = {
	google: "google",
};

const IDENTIFIER_MAP = {
	[PROVIDERS.google]: IDENTIFIER_TYPE.oauthGoogle
};

const sessionCookie = createCookie("session", {
	httpOnly: true,
	maxAge: 365 * seconds.day,
	sameSite: "lax",
})

const authService = AuthService({
	baseURL: new URL(url),
	async onSuccess(request, redirectURI, params) {
		const claims = params.tokenSet.claims();
		assert.ok(params.provider in IDENTIFIER_MAP);
		const existingAccount = await AccountStore.fromIdentifier(IDENTIFIER_MAP[params.provider], claims.sub);

		if (E.isLeft(existingAccount)) {
			return E.left(new Error(`Failed to get account from identifier ${IDENTIFIER_MAP[params.provider]}`));
		}

		let account = existingAccount.right;

		if (!account) {
			const res = await AccountStore.createAccount({
				firstName: claims.given_name ?? "",
				lastName: claims.family_name ?? "",
				identifier: {
					type: IDENTIFIER_MAP[params.provider],
					value: claims.sub as NonExistingIdentifier
				}
			});

			if (E.isLeft(res)) {
				return E.left(new Error("Failed to create an account "));
			}

			account = res.right;
		}

		const token = await new SignJWT({
			accountID: account.id,
		})
			.setProtectedHeader({ alg: "RS512" })
			.setExpirationTime("1y")
			.setIssuer(issuer)
			.sign(await importPKCS8(jwtPrivkey, "RS512"));
		const headers = new Headers();
		headers.set("Location", redirectURI);

		setCookie(headers, {
			name: `session:${account.id}`,
			value: token,
			sameSite: "Lax",
			httpOnly: true,
			maxAge: 365 * seconds.day,
		});

		return E.right(new Response(null, {
			status: STATUS_CODE.found,
			headers,
		}));
	}
});

authService.addProvider(PROVIDERS.google, GoogleProvider({
	clientID: "",
	clientSecret: "",
	scope: "",
	accessType: "online",
}));

const authRoute = (() => {
	const route = new Hono();
	const middlewares = authService.getMiddlewares();
	const handlers = authService.getHandlers();
	for (const [path, funcs] of middlewares) {
		route.use(path, );
	}



	return route;
})();

app.route("/auth", authRoute);


app.get("/ping", (c) => c.text("pong"));

app.all("*",
	staticServer,
	createMiddleware(async ctx => {
		const handler = createRequestHandler(build, mode);
		return await handler(ctx.req.raw, ctx.env);
	}));


serve({
	fetch: app.fetch,
	port: Number(port),
	hostname
}, addr => {
	const origin = Match.value(addr).pipe(
		Match.when({family: "IPv4"}, (a) => `http://${a.address}:${a.port}`),
		Match.when({family: "IPv6"}, (a) => `http://[${a.address}]:${a.port}`),
		Match.orElse((a) => a.address)
	);

	console.log(`Listening on ${origin}`);
});

function run() {

}

function main() {

}

main();
