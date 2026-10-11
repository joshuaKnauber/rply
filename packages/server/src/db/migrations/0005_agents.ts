import { randomInt } from "node:crypto";
import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
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

  const channels = await db.selectFrom("channels").select(["id", "agent_token_hash", "agent_public_key", "created_at"]).execute();
  for (const c of channels) {
    await db
      .insertInto("agent_tokens")
      .values({
        id: Array.from({ length: 16 }, () => "0123456789abcdefghjkmnpqrstvwxyz"[randomInt(32)]).join(""),
        channel_id: c.id,
        token_hash: c.agent_token_hash,
        label: null,
        public_key: c.agent_public_key,
        created_at: c.created_at,
        last_seen_at: null,
        revoked_at: null,
      })
      .execute();
  }

  await db.schema.alterTable("pairing_codes").addColumn("role", "text", (c) => c.notNull().defaultTo("human")).execute();
  await db.schema.alterTable("secret_requests").addColumn("public_key", "text").execute();
}
