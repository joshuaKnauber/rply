import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Kysely, SqliteDialect } from "kysely";
import { Migrator, type Migration } from "kysely/migration";
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

export async function openDatabase(path: string): Promise<DB> {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const db = new Kysely<Database>({ dialect: new SqliteDialect({ database: nodeSqlite(sqlite) }) });
  await migrate(db, (version) => backup(sqlite, path, version));
  return db;
}

async function migrate(db: DB, backup: (version: string) => void) {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
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
