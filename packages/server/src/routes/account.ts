import { Hono } from "hono";
import type { AccountExport } from "@rply/schema";
import { requireUser } from "../auth.ts";
import type { AppEnv, Deps } from "../context.ts";
import { selectLiveMessages, toMessage } from "../messages.ts";
import { toChannel } from "../serialize.ts";

export function accountRoutes(deps: Deps) {
  const { db } = deps;

  return new Hono<AppEnv>().get("/account/export", requireUser(deps), async (c) => {
    const { user } = c.var;
    const memberships = await db
      .selectFrom("channel_members as m")
      .innerJoin("channels", "channels.id", "m.channel_id")
      .selectAll("channels")
      .select(["m.role"])
      .where("m.user_id", "=", user.id)
      .orderBy("channels.created_at", "asc")
      .execute();

    const channels = await Promise.all(
      memberships.map(async (row) => {
        const [agents, messages, files, storage] = await Promise.all([
          db.selectFrom("agent_tokens").select(["label", "created_at", "last_seen_at", "revoked_at"]).where("channel_id", "=", row.id).orderBy("created_at").execute(),
          selectLiveMessages(db).where("messages.channel_id", "=", row.id).orderBy("messages.seq", "asc").execute(),
          db.selectFrom("files").select(["id", "name", "mime", "size", "message_id", "created_at"]).where("channel_id", "=", row.id).where("deleted_at", "is", null).execute(),
          db.selectFrom("app_storage").select(["app_key", "value"]).where("channel_id", "=", row.id).where("user_id", "=", user.id).execute(),
        ]);
        return {
          ...toChannel(row),
          role: row.role,
          agents,
          messages: messages.map(toMessage),
          files,
          app_storage: Object.fromEntries(storage.map((s) => [s.app_key, JSON.parse(s.value)])),
        };
      }),
    );

    const body: AccountExport = { exported_at: Date.now(), user: { id: user.id, email: user.email, name: user.name }, channels };
    c.header("content-disposition", `attachment; filename="rply-export-${new Date().toISOString().slice(0, 10)}.json"`);
    return c.json(body);
  });
}
