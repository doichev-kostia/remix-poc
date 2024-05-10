import { defineConfig } from 'drizzle-kit'
import * as process from "node:process";
import * as assert from "node:assert";

const url = process.env.DB_URL;
assert.ok(url, "DB_URL required")

export default defineConfig({
	schema: "./internal/db/schema.ts",
	dialect: 'postgresql',
	dbCredentials: {
		url: url,
	},
	verbose: true,
	strict: true,
})
