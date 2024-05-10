import { char, timestamp } from "drizzle-orm/pg-core";

export const cuid = (name: string) => char(name, { length: 24 });

export const id = {
	get id() {
		return cuid("id").primaryKey().notNull();
	},
};

export const workspaceID = {
	get id() {
		return cuid("id").notNull();
	},
	get workspaceID() {
		return cuid("workspace_id").notNull();
	}
};

export const timestamps = {
	get createTime() {
		return timestamp("create_time").notNull().defaultNow()
	},
	get updateTime() {
		return timestamp("update_time").notNull().defaultNow().$onUpdateFn(() => new Date())
	},
}

export function castToEnum<T extends object, V = T[keyof T]>(object: T) {
	return Object.values(object) as any as Readonly<[V, ...V[]]>;
}
