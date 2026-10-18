import type { Kysely } from "kysely";

// the look the human picked for an agent's bird (JSON), null for the generated default
export async function up(db: Kysely<any>) {
  await db.schema.alterTable("agent_tokens").addColumn("avatar", "text").execute();
}
