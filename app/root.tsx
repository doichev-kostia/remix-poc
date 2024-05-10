import { Links, Meta, Outlet, Scripts, } from "@remix-run/react";
import type { LinksFunction } from "@remix-run/server-runtime";

import styles from "./main.css?url";
import React from "react";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: styles },
];

export default function App() {
	return (
		<html>
		<head>
			<link
				rel="icon"
				href="data:image/x-icon;base64,AA"
			/>
			<Meta />
			<Links />
		</head>
		<body>
		<Outlet />

		<Scripts />
		</body>
		</html>
	);
}
