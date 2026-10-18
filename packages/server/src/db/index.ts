import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Kysely, PostgresDialect, sql, SqliteDialect } from "kysely";
import pg from "pg";
import { Migrator, type Migration } from "kysely/migration";
import { isPostgres } from "./dialect.ts";
import { nodeSqlite } from "./node-sqlite.ts";
import type { Database } from "./schema.ts";
import * as m0001 from "./migrations/0001_init.ts";
import * as m0002 from "./migrations/0002_drop_api_keys.ts";
import * as m0003 from "./migrations/0003_message_age.ts";
import * as m0004 from "./migrations/0004_state_note.ts";
import * as m0005 from "./migrations/0005_message_agent.ts";
import * as m0006 from "./migrations/0006_state_agent.ts";
import * as m0007 from "./migrations/0007_agent_avatar.ts";
import * as m0008 from "./migrations/0008_message_mentions.ts";

const migrations: Record<string, Migration> = {
  "0001_init": m0001,
  "0002_drop_api_keys": m0002,
  "0003_message_age": m0003,
  "0004_state_note": m0004,
  "0005_message_agent": m0005,
  "0006_state_agent": m0006,
  "0007_agent_avatar": m0007,
  "0008_message_mentions": m0008,
};

export type DB = Kysely<Database>;

pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);

export const isPostgresUrl = (target: string) => /^postgres(ql)?:\/\//.test(target);

// PlanetScale and libpq 16 use sslrootcert=system for "the system's CAs"; pg would read it as a file path,
// and Node verifies against its built-in CAs anyway, so drop it (sslmode=verify-full still applies)
function withoutSystemRootCert(target: string) {
  const url = new URL(target);
  if (url.searchParams.get("sslrootcert") === "system") url.searchParams.delete("sslrootcert");
  return url.toString();
}

export const databaseFromEnv = (env: NodeJS.ProcessEnv) => env.RPLY_DATABASE_URL ?? env.RPLY_DB ?? "rply.db";

export async function openDatabase(target: string): Promise<DB> {
  if (isPostgresUrl(target)) {
    const pool = new pg.Pool({ connectionString: withoutSystemRootCert(target), max: 10, allowExitOnIdle: true });
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
  const recorded = await sql<{ name: string }>`select name from kysely_migration`.execute(db).then((r) => r.rows.map((m) => m.name), () => []);
  if (recorded.some((name) => !(name in migrations))) {
    throw new Error("This database was created before the migrations were reset on 2026-10-12. Delete it (and the files folder next to it) and start again.");
  }
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
