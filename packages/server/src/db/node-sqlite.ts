import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SqliteDatabase } from "kysely";

export function nodeSqlite(db: DatabaseSync): SqliteDatabase {
  return {
    close: () => db.close(),
    prepare(sql) {
      const stmt = db.prepare(sql);
      const args = (params: ReadonlyArray<unknown>) => params as SQLInputValue[];
      return {
        reader: stmt.columns().length > 0,
        all: (params) => stmt.all(...args(params)),
        run: (params) => stmt.run(...args(params)),
        iterate: (params) => stmt.iterate(...args(params)),
      };
    },
  };
}
