import type { Writable } from "node:stream";
import * as O from "effect/Option";
import * as E from "effect/Either";
import { ConfigSchema, parseConfig } from "~/cmd/web/config.js";
import { type LoggerOptions, pino } from "pino";
import { AccountStore } from "~/internal/store/account/account.js";
import { type DB, initDB } from "~/internal/db/drizzle.js";
import { TransactionContext } from "~/internal/db/transaction.js";
import fastify from "fastify";
import { createId } from "@paralleldrive/cuid2";
import closeWithGrace from "close-with-grace";
import * as process from "node:process";
import type { Logger } from "~/internal/logger.js";
import { addRoutes } from "~/cmd/web/routes.js";
import { z } from "zod";

export type Application = {
	config: z.infer<typeof ConfigSchema>
	logger: Logger;
	db: DB;
	accountStore: ReturnType<typeof AccountStore>;
}

declare module "fastify" {
	interface FastifyInstance {
		app: Application;
	}
}

type GetEnvFunc = (env: string) => O.Option<string>;

async function run(args: string[], getEnv: GetEnvFunc, stdout: Writable = process.stdout, stderr: Writable = process.stderr): Promise<O.Option<Error>> {
	const parsingResult = parseConfig(args, getEnv);

	if (E.isLeft(parsingResult)) {
		stderr.write("Failed to parse config");
		stderr.write(String(parsingResult.left));
		return O.some(parsingResult.left);
	}

	const config = parsingResult.right;
	const options: LoggerOptions = {
		level: config.loggerLevel,
	};

	if (config.prettyPrint) {
		options.transport = {
			target: "pino-pretty"
		};
	}

	const logger = pino(options, stdout);
	const db = initDB(config.dbURI);
	TransactionContext.withDefault({tx: db});

	const accountStore = AccountStore({
		db,
	});

	const instance = fastify({
		logger,
		genReqId() {
			return createId();
		},
	});

	instance.decorate("app", {
		config,
		logger,
		db,
		accountStore,
	});

	instance.register(addRoutes);

	const closeListeners = closeWithGrace({
		delay: config.closeTimeoutMs
	}, async function ({signal, err, manual,}) {
		logger.warn(`interrupt signal "${signal}"`);
		if (err) {
			instance.log.error(err);
		}
		await instance.close();
	} as closeWithGrace.CloseWithGraceAsyncCallback);


	instance.addHook("onClose", (instance, done) => {
		closeListeners.uninstall();
		done();
	});

	logger.info("Setting up the application");
	const result = await instance.ready().then(E.right, E.left);
	if (E.isLeft(result)) {
		logger.fatal(result.left, "Failed to setup the application");
		return O.some(result.left);
	}

	const [hostname, port] = config.addr.split(":");

	const listeningResult = await instance.listen({
		host: hostname,
		port: parseInt(port),
	}).then(E.right, E.left);

	if (E.isLeft(listeningResult)) {
		logger.fatal(listeningResult.left, "Failed to launch a server");
		return O.some(listeningResult.left);
	}

	return O.none();
}

async function main() {
	function getEnv(name: string) {
		if (process.env[name] != null) {
			return O.some(process.env[name]!);
		} else {
			return O.none();
		}
	}

	const result = await run(process.argv.slice(2), getEnv, process.stdout, process.stderr);

	if (O.isSome(result)) {
		process.exit(1);
	}
}

void main();

