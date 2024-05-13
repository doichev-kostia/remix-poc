import React, { useContext } from "react";

export type AppState = {
	currentAccountID: string;
	currentMemberID: string;
	accounts: Record<string, {
		id: string;
		displayName: string;
		memberships: Record<string, {
			id: string;
			type: string;
			workspace: {
				id: string;
				slug: string;
			}
		}>
	}>
}

export const AppStateContext = React.createContext<AppState | null>(null)

export function useAppState() {
	const context = useContext(AppStateContext);
	if (!context) {
		throw new Error("The AppState context is not available. Are you sure that hooks is called within the Provider?")
	}

	return context;
}
