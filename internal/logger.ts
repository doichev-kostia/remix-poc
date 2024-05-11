export interface Logger {
	info(message: string): void
	error(message: string): void
	warn(message: string): void;
	debug(message: string): void;
}

export const noopLogger: Logger = {
	info() {},
	error() {},
	warn() {},
	debug() {},
}
