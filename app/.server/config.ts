import * as process from "node:process";
import { z } from "zod";

const values = {
	loggerLevel: process.env.LOGGER_LEVEL || "info",
	prettyPrint: process.env.PRETTY_PRINT === "true" || false,
	secureCookies: process.env.SECURE_COOKIE === "true" || false,
	issuer: process.env.ISSUER || "trellix.com",
	JWTSecret: process.env.JWT_SECRET,
	dbURI: process.env.DB_URI,
}

const schema = z.object({
	loggerLevel: z.string(),
	prettyPrint: z.boolean(),
	secureCookies: z.boolean(),
	issuer: z.string(),
	JWTSecret: z.string().transform((x) => new TextEncoder().encode(x)),
	dbURI: z.string(),
});

export const config = schema.parse(values);
