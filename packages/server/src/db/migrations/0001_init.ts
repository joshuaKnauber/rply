import type { Kysely } from "kysely";
import { isPostgres, seqColumn } from "../dialect.ts";

export async function up(db: Kysely<any>) {
  const pg = isPostgres(db);
  const bool = pg ? "boolean" : "integer";
  const date = pg ? "timestamptz" : "date";

  // user, session, account, verification and passkey follow better-auth's schema (camelCase, its own date columns)
  await db.schema
    .createTable("user")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("email", "text", (c) => c.notNull().unique())
    .addColumn("emailVerified", bool, (c) => c.notNull())
    .addColumn("image", "text")
    .addColumn("createdAt", date, (c) => c.notNull())
    .addColumn("updatedAt", date, (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("session")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("expiresAt", date, (c) => c.notNull())
    .addColumn("token", "text", (c) => c.notNull().unique())
    .addColumn("createdAt", date, (c) => c.notNull())
    .addColumn("updatedAt", date, (c) => c.notNull())
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .execute();
  await db.schema.createIndex("session_userId_idx").on("session").column("userId").execute();

  await db.schema
    .createTable("account")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("providerId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("idToken", "text")
    .addColumn("accessTokenExpiresAt", date)
    .addColumn("refreshTokenExpiresAt", date)
    .addColumn("scope", "text")
    .addColumn("password", "text")
    .addColumn("createdAt", date, (c) => c.notNull())
    .addColumn("updatedAt", date, (c) => c.notNull())
    .execute();
  await db.schema.createIndex("account_userId_idx").on("account").column("userId").execute();

  await db.schema
    .createTable("verification")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("identifier", "text", (c) => c.notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .addColumn("expiresAt", date, (c) => c.notNull())
    .addColumn("createdAt", date, (c) => c.notNull())
    .addColumn("updatedAt", date, (c) => c.notNull())
    .execute();
  await db.schema.createIndex("verification_identifier_idx").on("verification").column("identifier").execute();

  await db.schema
    .createTable("passkey")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("publicKey", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("credentialID", "text", (c) => c.notNull())
    .addColumn("counter", "integer", (c) => c.notNull())
    .addColumn("deviceType", "text", (c) => c.notNull())
    .addColumn("backedUp", bool, (c) => c.notNull())
    .addColumn("transports", "text")
    .addColumn("createdAt", date)
    .addColumn("aaguid", "text")
    .execute();
  await db.schema.createIndex("passkey_userId_idx").on("passkey").column("userId").execute();
  await db.schema.createIndex("passkey_credentialID_idx").on("passkey").column("credentialID").execute();

  await db.schema
    .createTable("api_keys")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("label", "text", (c) => c.notNull())
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("api_keys_user").on("api_keys").column("user_id").execute();

  await db.schema
    .createTable("channels")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("e2e", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("channel_members")
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("user_id", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("read_seq", "bigint", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .addPrimaryKeyConstraint("channel_members_pk", ["channel_id", "user_id"])
    .execute();
  await db.schema.createIndex("channel_members_user").on("channel_members").column("user_id").execute();

  await db.schema
    .createTable("agent_tokens")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("label", "text")
    .addColumn("public_key", "text")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .addColumn("last_seen_at", "bigint")
    .addColumn("revoked_at", "bigint")
    .execute();
  await db.schema.createIndex("agent_tokens_channel").on("agent_tokens").column("channel_id").execute();

  await db.schema
    .createTable("pairing_codes")
    .addColumn("code_hash", "text", (c) => c.primaryKey())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("expires_at", "bigint", (c) => c.notNull())
    .addColumn("used_at", "bigint")
    .execute();
  await db.schema.createIndex("pairing_codes_channel").on("pairing_codes").column("channel_id").execute();

  await db.schema
    .createTable("messages")
    .$call(seqColumn(db))
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
    .addColumn("deleted_at", "bigint")
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
    .$call(seqColumn(db))
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("changes_channel_seq").on("changes").columns(["channel_id", "seq"]).execute();

  await db.schema
    .createTable("secret_requests")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("target", "text", (c) => c.notNull())
    .addColumn("mode", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("ciphertext", "text")
    .addColumn("public_key", "text", (c) => c.notNull())
    .addColumn("expires_at", "bigint")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .addColumn("closed_at", "bigint")
    .execute();

  await db.schema
    .createTable("files")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("message_id", "text")
    .addColumn("uploader", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("mime", "text", (c) => c.notNull())
    .addColumn("size", "bigint", (c) => c.notNull())
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .addColumn("deleted_at", "bigint")
    .execute();
  await db.schema.createIndex("files_message").on("files").column("message_id").execute();

  await db.schema
    .createTable("app_storage")
    .addColumn("user_id", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("channel_id", "text", (c) => c.notNull().references("channels.id").onDelete("cascade"))
    .addColumn("app_key", "text", (c) => c.notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .addColumn("updated_at", "bigint", (c) => c.notNull())
    .addPrimaryKeyConstraint("app_storage_pk", ["user_id", "channel_id", "app_key"])
    .execute();

  await db.schema
    .createTable("push_subscriptions")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("endpoint", "text", (c) => c.notNull())
    .addColumn("p256dh", "text", (c) => c.notNull())
    .addColumn("auth", "text", (c) => c.notNull())
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("push_subscriptions_endpoint").on("push_subscriptions").column("endpoint").execute();
  await db.schema.createIndex("push_subscriptions_user").on("push_subscriptions").column("user_id").execute();

  await db.schema
    .createTable("settings")
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("value", "text", (c) => c.notNull())
    .execute();
}
