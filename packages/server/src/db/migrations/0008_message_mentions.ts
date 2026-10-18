import type { Kysely } from "kysely";

// agent ids a human message @mentions (JSON); only those agents receive it, null reaches every agent
export async function up(db: Kysely<any>) {
  await db.schema.alterTable("messages").addColumn("mentions", "text").execute();
}
