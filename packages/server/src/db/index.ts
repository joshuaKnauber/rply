import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Kysely, PostgresDialect, sql, SqliteDialect } from "kysely";
import pg from "pg";
import { Migrator, type Migration } from "kysely/migration";
import { isPostgres } from "./dialect.ts";
import { nodeSqlite } from "./node-sqlite.ts";
import type { Database } from "./schema.ts";
import * as m0001 from "./migrations/0001_init.ts";
import * as m0002 from "./migrations/0002_secrets.ts";
import * as m0003 from "./migrations/0003_files.ts";
import * as m0004 from "./migrations/0004_push.ts";
import * as m0005 from "./migrations/0005_agents.ts";

const migrations: Record<string, Migration> = {
  "0001_init": m0001,
  "0002_secrets": m0002,
  "0003_files": m0003,
  "0004_push": m0004,
  "0005_agents": m0005,
};

export type DB = Kysely<Database>;

pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);

export const isPostgresUrl = (target: string) => /^postgres(ql)?:\/\//.test(target);

export async function openDatabase(target: string): Promise<DB> {
  if (isPostgresUrl(target)) {
    const pool = new pg.Pool({ connectionString: target, max: 10, allowExitOnIdle: true });
    const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
    await migrate(db, () => {});
    return db;
  }
  const sqlite = new DatabaseSync(target);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const db = new Kysely<Database>({ dialect: new SqliteDialect({ database: nodeSqlite(sqlite) }) });
  await migrate(db, (version) => backup(sqlite, target, version));
  return db;
}

async function migrate(db: DB, backup: (version: string) => void) {
  const migrationTableSchema = isPostgres(db) ? (await sql<{ schema: string }>`select current_schema() as schema`.execute(db)).rows[0]!.schema : undefined;
  const migrator = new Migrator({ db, migrationTableSchema, provider: { getMigrations: async () => migrations } });
  const all = await migrator.getMigrations();
  const executed = all.filter((m) => m.executedAt);
  if (executed.length === all.length) return;
  if (executed.length > 0) backup(executed.at(-1)!.name);

  const { error, results } = await migrator.migrateToLatest();
  for (const r of results ?? []) console.log(`migration ${r.migrationName}: ${r.status}`);
  if (error) throw error;
}

function backup(sqlite: DatabaseSync, path: string, version: string) {
  if (path === ":memory:") return;
  const target = `${path}.bak-${version}`;
  if (existsSync(target)) return;
  sqlite.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  console.log(`backed up database to ${target}`);
}
