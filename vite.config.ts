import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import * as path from "node:path";
import { installGlobals } from "@remix-run/node";

installGlobals();

export default defineConfig({
	plugins: [remix()],
	optimizeDeps: {
		exclude: ["@node-rs/argon2"]
	},
	build: {
		rollupOptions: {
			external: ["@node-rs/argon2"]
		},
	},
	resolve: {
		alias: {
			"~": path.resolve(".")
		}
	}
});
