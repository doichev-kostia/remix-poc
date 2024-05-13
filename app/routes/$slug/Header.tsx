import { useWorkspace } from "~/app/routes/$slug._index/context.js";
import { useAppState } from "~/app/app-state.js";

export function Header() {
	const appState = useAppState();
	const workspace = useWorkspace()

	return (
		<header>
			head
		</header>
	)
}
