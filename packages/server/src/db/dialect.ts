import { PostgresAdapter, sql, type CreateTableBuilder, type Kysely } from "kysely";

export const isPostgres = (db: Kysely<any>) => db.getExecutor().adapter instanceof PostgresAdapter;

export const seqColumn = (db: Kysely<any>) => (table: CreateTableBuilder<any, any>) =>
  isPostgres(db) ? table.addColumn("seq", "bigserial", (c) => c.primaryKey()) : table.addColumn("seq", "integer", (c) => c.primaryKey().autoIncrement());

// Postgres hands out seq values before commit, so concurrent inserts can commit out of order
// and a cursor that already moved past the later one would skip the earlier one forever.
export async function inSeqOrder<DB extends Kysely<any>>(db: DB, fn: (trx: DB) => Promise<void>) {
  const run = async (trx: DB) => {
    if (isPostgres(trx)) await sql`select pg_advisory_xact_lock(4242)`.execute(trx);
    await fn(trx);
  };
  if (db.isTransaction) return run(db);
  await db.transaction().execute((trx) => run(trx as unknown as DB));
}
