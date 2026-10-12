import type { Kysely } from "kysely";

// daily message quotas and retention look messages up by channel and age
export async function up(db: Kysely<any>) {
  await db.schema.createIndex("messages_channel_created").on("messages").columns(["channel_id", "created_at"]).execute();
}
