import { AsyncLocalStorage } from "node:async_hooks";

const ErrorCode = Symbol('ContextError');

export class ContextNotFoundError extends Error {
	readonly code = ErrorCode;

	constructor(public name: string) {
		super(`${name} context was not provided.`);
	}
}

export type Context<T> = ReturnType<typeof create<T>>;

export function create<T>(name: string) {
	const storage = new AsyncLocalStorage<T>();

	const ctx = {
		name,
		with<Result>(value: T, cb: (value: T) => Result) {
			return storage.run(value, () => {
				return cb(value);
			});
		},
		use(): [T, null] | [null, ContextNotFoundError] {
			const result = storage.getStore();
			if (result === undefined) {
				return [null, new ContextNotFoundError(name)]
			} else {
				return [result, null];
			}
		},
	};
	return ctx;
}

export const Context = {
	create,
};
