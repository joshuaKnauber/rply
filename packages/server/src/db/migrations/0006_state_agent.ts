import type { Kysely } from "kysely";

// which agent acknowledged a human message, so the apps can show who is working on it
export async function up(db: Kysely<any>) {
  await db.schema.alterTable("messages").addColumn("state_agent_id", "text").execute();
}
