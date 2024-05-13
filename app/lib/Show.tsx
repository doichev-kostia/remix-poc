import React from "react";

/**
 * Conditionally render its children or an optional fallback component
 * @description https://www.solidjs.com/docs/latest/api#show
 */
type ShowProps<T, RenderFunction extends (item: NonNullable<T>) => React.ReactNode> = {
	when: T | undefined | null | false,
	fallback: React.ReactNode;
	children: React.ReactNode | RenderFunction;
}

export function Show<T, RenderFunction extends (item: NonNullable<T>) => React.ReactNode>(props: ShowProps<T, RenderFunction>) {
	if (props.when == null || props.when === false) {
		return <>{props.fallback}</>;
	}

	if (typeof props.children === "function") {
		return <>{props.children(props.when)}</>;
	} else {
		return <>{props.children}</>;
	}
}
