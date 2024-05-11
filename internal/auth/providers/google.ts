import { OauthProvider, type OauthBasicConfig } from "./oauth.js";
import { Issuer } from "openid-client";

const issuer = await Issuer.discover("https://accounts.google.com");

type GoogleConfig = OauthBasicConfig & {
	prompt?: "none" | "consent" | "select_account";
	accessType: "online" | "offline";
}

export function GoogleProvider(config: GoogleConfig) {
	let parameters: Record<string, string> = {};

	if (config.accessType) {
		parameters.access_type = config.accessType
	}

	if (config.parameters) {
		parameters = Object.assign(parameters, config.parameters);
	}

	return OauthProvider({
		clientID: config.clientID,
		clientSecret: config.clientSecret,
		prompt: config.prompt,
		scope: config.scope,
		issuer,
		parameters,
	})
}
