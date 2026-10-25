import type { Kysely } from "kysely";

// last unread-messages email per user without push, so we don't repeat ourselves
export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("unread_emails")
    .addColumn("user_id", "text", (c) => c.primaryKey().references("user.id").onDelete("cascade"))
    .addColumn("seq", "bigint", (c) => c.notNull())
    .addColumn("sent_at", "bigint", (c) => c.notNull())
    .execute();
}
