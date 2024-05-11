import path from "node:path";
import * as http from "node:http";
import * as http2 from "node:http2";
import * as https from "node:https";
import { PassThrough } from "node:stream";

import fp from "fastify-plugin";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteGenericInterface } from "fastify";
import { createRequestHandler, type ServerBuild, createReadableStreamFromReadable, writeReadableStreamToWritable } from "@remix-run/node";
import type { RouteHandlerMethod } from "fastify/types/route.js";

export type HttpServer =
	| http.Server
	| https.Server
	| http2.Http2Server
	| http2.Http2SecureServer;


export const remix = fp(async function remix(fastify: FastifyInstance) {
	const viteDevServer = fastify.app.config.devServer === true ? await import("vite").then((vite) =>
		vite.createServer({
			server: {middlewareMode: true},
		})
	) : null;

	let SERVER_BUILD = path.join(fastify.app.config.remixApp, "server", "index.js");

	if (viteDevServer) {
		const middie = await import("@fastify/middie").then((mod) => mod.default);
		await fastify.register(middie);
		fastify.use(viteDevServer.middlewares);
	} else {
		const BUILD_DIR = path.join(fastify.app.config.remixApp, "client");
		await fastify.register(fastifyStatic, {
			root: BUILD_DIR,
			prefix: "/",
			wildcard: false,
			cacheControl: false, // TODO: double-check
			dotfiles: "allow",
			etag: true,
			serveDotFiles: true,
			lastModified: true,
		});
	}



	let build: ServerBuild | (() => Promise<ServerBuild>);
	if (viteDevServer) {
		build = () => viteDevServer.ssrLoadModule("virtual:remix/server-build") as any;
	} else {
		build = await import(SERVER_BUILD);
	}

	fastify.register(async function createRemixRequestHandler(childServer) {
		// remove the default content type parsers
		childServer.removeAllContentTypeParsers();
		// allow all content types
		childServer.addContentTypeParser("*", (_request, payload, done) => {
			done(null, payload);
		});


		// handle SSR requests
		childServer.all("*", async (request, reply): Promise<RouteHandlerMethod> => {
			try {
				const handler = createRequestHandler(
					build,
					fastify.app.config.mode,
				);

				return async (request, reply) => {
					const remixRequest = createRemixRequest(request, reply);

					const response = await handler(remixRequest, fastify.app)
					return sendRemixResponse(reply, response);
				}
			} catch (error) {
				console.error(error);
				return reply.status(500).send(error);
			}
		});
	});


	function createRemixHeaders(
		requestHeaders: FastifyRequest["headers"],
	): Headers {
		let headers = new Headers();

		for (let [key, values] of Object.entries(requestHeaders)) {
			if (values) {
				if (Array.isArray(values)) {
					for (let value of values) {
						headers.append(key, value);
					}
				} else {
					headers.set(key, values);
				}
			}
		}

		return headers;
	}

	function getUrl<Server extends HttpServer>(
		request: FastifyRequest<RouteGenericInterface, Server>,
	): string {
		let origin = `${request.protocol}://${request.hostname}`;
		let url = `${origin}${request.url}`;
		return url;
	}

	function createRemixRequest<Server extends HttpServer>(
		request: FastifyRequest<RouteGenericInterface, Server>,
		reply: FastifyReply<Server>,
	): Request {
		let url = getUrl(request);

		// Abort action/loaders once we can no longer write a response
		let controller = new AbortController();
		reply.raw.on("close", () => controller.abort());

		let init: RequestInit = {
			method: request.method,
			headers: createRemixHeaders(request.headers),
			signal: controller.signal,
		};

		if (request.method !== "GET" && request.method !== "HEAD") {
			init.body = createReadableStreamFromReadable(request.raw);
			(init as { duplex: "half" }).duplex = "half";
		}

		return new Request(url, init);
	}

	async function sendRemixResponse<Server extends HttpServer>(
		reply: FastifyReply<Server>,
		nodeResponse: Response,
	): Promise<void> {
		reply.status(nodeResponse.status);

		for (let [key, values] of nodeResponse.headers.entries()) {
			reply.headers({ [key]: values });
		}

		if (nodeResponse.body) {
			let stream = new PassThrough();
			reply.send(stream);
			await writeReadableStreamToWritable(nodeResponse.body, stream);
		} else {
			reply.send();
		}
		return reply;
	}
});
