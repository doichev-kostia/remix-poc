import { type LoggerOptions, pino } from "pino";
import { config } from "~/app/.server/config.js";

const options: LoggerOptions = {
	level: config.loggerLevel,
}

if (config.prettyPrint) {
	options.transport = {
		target: "pino-pretty"
	}
}

export const logger = pino(options);
