import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema.dropTable("api_keys").execute();
}
