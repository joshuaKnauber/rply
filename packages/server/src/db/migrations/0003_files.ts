import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
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
}
