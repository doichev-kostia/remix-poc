import { type FastifyInstance } from "fastify";
import { remix } from "./remix.js";

export async function addRoutes(fastify: FastifyInstance) {

	fastify.get("/ping", async (request, reply) => {
		reply
			.header("Content-Type", "text/plain")
			.send("pong")
		return;
	});

	fastify.register(remix);
}
