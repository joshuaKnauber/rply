import type { Kysely } from "kysely";

// short detail next to a human message's state, e.g. "Working on it · running tests"
export async function up(db: Kysely<any>) {
  await db.schema.alterTable("messages").addColumn("state_note", "text").execute();
}
