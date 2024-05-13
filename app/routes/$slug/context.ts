import React, { useContext } from "react";

export type Workspace = {
	id: string;
	slug: string;
}

export const WorkspaceContext = React.createContext<Workspace | null>(null);

export function useWorkspace() {
	const context = useContext(WorkspaceContext);

	if (!context) {
		throw new Error("The Workspace context is not available. Are you sure that hooks is called within the Provider?")
	}

	return context;
}
