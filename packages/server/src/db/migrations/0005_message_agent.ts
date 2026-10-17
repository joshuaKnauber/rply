import type { Kysely } from "kysely";

// which agent token sent a message, so channels with several agents can tell them apart
export async function up(db: Kysely<any>) {
  await db.schema.alterTable("messages").addColumn("agent_id", "text").execute();
}
