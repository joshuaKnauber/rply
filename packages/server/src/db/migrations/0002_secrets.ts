import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
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
    .addColumn("expires_at", "bigint")
    .addColumn("created_at", "bigint", (c) => c.notNull())
    .addColumn("closed_at", "bigint")
    .execute();
}
