import { requireAccount } from "~/app/auth.js";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
	const state = await requireAccount(request)

	return {
		state
	}
}
function WorkspacePage() {
	const { state } = useLoaderData<typeof loader>()

	const workspace = state.accounts[state.currentAccountID].memberships[state.currentMemberID].workspace;

	return (
		<section>
			<h1>This is my workspace {workspace.slug}</h1>
			<Link className="text-blue-400" to={"/join"}>Switch workspace</Link>
		</section>
	)
}

export default WorkspacePage
