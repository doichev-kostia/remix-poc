import { redirect } from "@remix-run/node";

export async function action() {
// TODO: use the regular <form action="/logout" method="post"/> so it refreshes the page and clears all the things
	return redirect('/sign-in', {
		headers: {
			"Set-Cookie": "", // TODO: use remix cookie to set cookie value to "" and maxAge to 0
		}
	})
}
