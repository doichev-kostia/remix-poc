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

const { devServer, addr, mode } = yargs(hideBin(process.argv))
	.option("dev-server", {
		type: "boolean",
		default: true,
	})
	.option("addr", {
		type: "string",
		default: ":3000", // host:port
	})
	.option("mode", {
		type: "string", // "development" | "production" | ...
		default: "development"
	})
	.parseSync();


const viteDevServer = devServer === true ? await import("vite").then((vite) =>
	vite.createServer({
		server: { middlewareMode: true },
	})
) : null;

type Bindings = HttpBindings;

type Env = { Bindings: Bindings };
const app = new Hono<Env>()

let staticServer: MiddlewareHandler;
if (viteDevServer) {
	staticServer = createMiddleware( async (ctx: Context<Env>, next) => {
		await new Promise((res) => {
			return viteDevServer.middlewares(ctx.env.incoming, ctx.env.outgoing, res)
		})
		await next();
	});
} else {
	staticServer = serveStatic({ root: "./build/client" })
}

let build: ServerBuild | (() => Promise<ServerBuild>);
if (viteDevServer) {
	build = () => viteDevServer.ssrLoadModule("virtual:remix/server-build") as any;
} else {
	const srv = path.resolve('build/server/index.js')
	build = await import(srv);
}

app.get("/ping", (c) => c.text("pong"))

app.all("*",
	staticServer,
	createMiddleware(async ctx => {
	const handler = createRequestHandler(build, mode);
	return await handler(ctx.req.raw, ctx.env)
}));

const [hostname, port] = addr.split(":")

serve({
	fetch: app.fetch,
	port: Number(port),
	hostname
}, addr => {
	const origin= Match.value(addr).pipe(
		Match.when({ family: "IPv4"}, (a) => `http://${a.address}:${a.port}`),
		Match.when({ family: "IPv6"}, (a) => `http://[${a.address}]:${a.port}`),
		Match.orElse((a) => a.address)
	);

	console.log(`Listening on ${origin}`)
});
