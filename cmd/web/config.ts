import yargs from "yargs";
import * as O from "effect/Option";
import * as E from "effect/Either";
import { z } from "zod";
import { milliseconds } from "~/internal/time.js";
import path from "node:path";

export const HelpError = new Error("[Internal] Config help was called")

type GetEnvFunc = (env: string) => O.Option<string>;

export const ConfigSchema = z.object({
	loggerLevel: z.enum(["error", "warn", "info", "debug"]),
	prettyPrint: z.boolean(),
	closeTimeoutMs: z.number().min(0),
	remixApp: z.string(),
	dbURI: z.string(),
	devServer: z.boolean(),
	issuer: z.string(),
	appURL: z.string(),
	addr: z.string(),
	mode: z.string(),
	jwtPubkey: z.string(),
	jwtPrivkey: z.string(),
});

export function parseConfig(argv: string[], getEnv: GetEnvFunc) {
	function withEnv<T = string>(name: string, fallback?: T, parser?: (val: string) => T): T {
		const value = getEnv(name).pipe(
			O.match({
				onSome(v) {
					return typeof parser === "function" ? parser(v) : v as T;
				},
				onNone() {
					return fallback;
				}
			})
		);

		return value!;
	}

	const config = yargs()
		.option("logger-level", {
			type: "string",
			default: withEnv("LOGGER_LEVEL", 'info')
		})
		.option("remix-app", {
			type: "string",
			description: "path to the remix application",
			default: withEnv("REMIX_APP", path.resolve(process.cwd(), 'build'))
		})
		.option("pretty-print", {
			type: "boolean",
			default: withEnv("PRETTY_PRINT", false)
		})
		.option("db-uri", {
			type: "string",
			default: withEnv("DB_URL")
		})
		.option("close-timeout-ms", {
			type: "number",
			description: "graceful shutdown timeout in milliseconds",
			default: withEnv("CLOSE_TIMEOUT_MS", 6 * milliseconds.second)
		})
		.option("dev-server", {
			type: "boolean",
			default: withEnv("DEV_SERVER", true, toBool),
		})
		.option("issuer", {
			type: "string",
			default: withEnv("ISSUER", "remix-poc")
		})
		.option("app-url", {
			type: "string",
		})
		.option("addr", {
			type: "string",
			default: withEnv("ADDRESS", ":3000"), // host:port
		})
		.option("mode", {
			type: "string", // "development" | "production" | ...
			default: withEnv("MODE", "development")
		})
		.option("jwt-pubkey", {
			type: "string",
			default: withEnv("JWT_PUBKEY_PATH", "./keys/public.pem")
		})
		.option("jwt-privkey", {
			type: "string",
			default: withEnv("JWT_PRIVKEY_PATH", "./keys/private.pem")
		});

	try {
		const options = config.parseSync(argv);
		options.dbURI = options.dbUri;
		const [host = "127.0.0.1", port] = options.addr.split(":")
		options.appURL = options.appUrl || `http://${host}:${port}`;

		return E.right(ConfigSchema.parse(options));
	} catch (error) {
		return E.left(error as Error)
	}
}

function toBool(v: string) {
	return v.trim().toLowerCase() === "true";
}
