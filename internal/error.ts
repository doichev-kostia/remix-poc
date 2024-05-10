export function is(error: Error, target: Error) {

}

function hash() {

}

export class AppError extends Error {
	_identifier: string;

	constructor(message: string) {
		super(message);
	}
}
