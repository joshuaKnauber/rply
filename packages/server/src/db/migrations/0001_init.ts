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
    .addColumn("pin", "text")
    .addColumn("state", "text")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .addColumn("updated_at", "bigint")
    .execute();
  await db.schema.createIndex("messages_channel_seq").on("messages").columns(["channel_id", "seq"]).execute();
  await db.schema.createIndex("messages_reply_to").on("messages").column("reply_to").execute();
  await db.schema.createIndex("messages_channel_pin").on("messages").columns(["channel_id", "pin"]).execute();

  await db.schema
    .createTable("asks")
    .addColumn("message_id", "text", (c) => c.primaryKey().references("messages.id").onDelete("cascade"))
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("expires_at", "bigint")
    .addColumn("answer_id", "text")
    .addColumn("closed_at", "bigint")
    .execute();
  await db.schema.createIndex("asks_channel_status").on("asks").columns(["channel_id", "status"]).execute();

  await db.schema
    .createTable("changes")
    .addColumn("seq", "integer", (c) => c.primaryKey().autoIncrement())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("changes_channel_seq").on("changes").columns(["channel_id", "seq"]).execute();
}
