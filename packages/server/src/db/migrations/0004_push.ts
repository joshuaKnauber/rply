import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("settings")
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("value", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("push_subscriptions")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("endpoint", "text", (c) => c.notNull())
    .addColumn("p256dh", "text", (c) => c.notNull())
    .addColumn("auth", "text", (c) => c.notNull())
    .addColumn("human_token_id", "text", (c) => c.references("human_tokens.id").onDelete("cascade"))
    .addColumn("api_key_id", "text", (c) => c.references("api_keys.id").onDelete("cascade"))
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("push_subscriptions_endpoint").on("push_subscriptions").column("endpoint").execute();
  await db.schema.createIndex("push_subscriptions_human_token").on("push_subscriptions").column("human_token_id").execute();
}
