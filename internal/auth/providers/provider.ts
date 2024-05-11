import type { Handler } from "../auth.js";
import * as E from "effect/Either";
import { type BaseClient, TokenSet } from "openid-client";

export type SuccessHandler = (request: Request, params: {
	client: BaseClient;
	tokenSet: TokenSet;
}) =>  Promise<E.Either<Response, Error>>;

export interface Provider {
	authorize(baseURL: URL): Handler
	callback(baseURL: URL, onSuccess: SuccessHandler): Handler
}
