import type { Application } from "~/cmd/web/main.js";

declare module "@remix-run/server-runtime" {
	interface AppLoadContext extends Application {

	}
}
