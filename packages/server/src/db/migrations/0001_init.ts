import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("channels")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("agent_token_hash", "text", (c) => c.notNull().unique())
    .addColumn("agent_public_key", "text")
    .addColumn("e2e", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("owner_id", "text")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("human_tokens")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("label", "text")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .addColumn("last_seen_at", "bigint")
    .addColumn("revoked_at", "bigint")
    .execute();

  await db.schema
    .createTable("pairing_codes")
    .addColumn("code_hash", "text", (c) => c.primaryKey())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("expires_at", "bigint", (c) => c.notNull())
    .addColumn("used_at", "bigint")
    .execute();

  await db.schema
    .createTable("api_keys")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("owner_id", "text")
    .addColumn("label", "text")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("messages")
    .addColumn("seq", "integer", (c) => c.primaryKey().autoIncrement())
    .addColumn("id", "text", (c) => c.notNull().unique())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("sender", "text", (c) => c.notNull())
    .addColumn("enc", "integer", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("reply_to", "text")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("messages_channel_seq").on("messages").columns(["channel_id", "seq"]).execute();
  await db.schema.createIndex("messages_reply_to").on("messages").column("reply_to").execute();

  await db.schema
    .createTable("status_pages")
    .addColumn("channel_id", "text", (c) => c.primaryKey().references("channels.id").onDelete("cascade"))
    .addColumn("enc", "integer", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("updated_at", "bigint", (c) => c.notNull())
    .execute();
}
