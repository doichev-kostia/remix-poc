import React from "react";
import { Header } from "~/app/routes/$slug._index/Header.js";
import { type AppState, AppStateContext } from "~/app/app-state.js";

type WorkspaceLayoutProps = {
	state: AppState;
	children: React.ReactNode
}

export function WorkspaceLayout({ state, children }: WorkspaceLayoutProps) {
	return (
		<AppStateContext.Provider value={state}>
				<Header/>
				<main>
					{children}
				</main>
		</AppStateContext.Provider>
	)
}
