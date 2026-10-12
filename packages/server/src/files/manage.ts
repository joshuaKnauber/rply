import { HTTPException } from "hono/http-exception";
import { fileIdsOf } from "@rply/schema/helpers";
import type { Deps } from "../context.ts";
import { now } from "../tokens.ts";

const UNSENT_TTL_MS = 24 * 60 * 60 * 1000;

export async function checkFiles({ db, files }: Deps, channelId: string, body: unknown) {
  const ids = [...new Set(fileIdsOf(body))];
  if (ids.length === 0) return ids;
  if (!files) throw new HTTPException(400, { message: "File attachments are turned off on this server" });
  const found = await db
    .selectFrom("files")
    .select("id")
    .where("id", "in", ids)
    .where("channel_id", "=", channelId)
    .where("deleted_at", "is", null)
    .execute();
  const missing = ids.filter((id) => !found.some((f) => f.id === id));
  if (missing.length) throw new HTTPException(400, { message: `Unknown file ${missing.join(", ")}. Upload it first` });
  return ids;
}

export async function linkFiles({ db }: Deps, ids: string[], messageId: string) {
  if (ids.length === 0) return;
  await db.updateTable("files").set({ message_id: messageId }).where("id", "in", ids).where("message_id", "is", null).execute();
}

async function remove(deps: Deps, ids: string[]) {
  if (ids.length === 0) return;
  await deps.db.updateTable("files").set({ deleted_at: now() }).where("id", "in", ids).execute();
  await Promise.all(ids.map((id) => deps.files?.store.remove(id)));
}

export async function deleteFilesOf(deps: Deps, messageId: string) {
  const rows = await deps.db.selectFrom("files").select("id").where("message_id", "=", messageId).where("deleted_at", "is", null).execute();
  await remove(deps, rows.map((r) => r.id));
}

export async function sweepFiles(deps: Deps) {
  if (!deps.files) return 0;
  const cutoff = now();
  const query = deps.db
    .selectFrom("files")
    .select("id")
    .where("deleted_at", "is", null)
    .where((eb) => {
      const unsent = eb.and([eb("message_id", "is", null), eb("created_at", "<", cutoff - UNSENT_TTL_MS)]);
      return deps.files!.retentionMs ? eb.or([unsent, eb("created_at", "<", cutoff - deps.files!.retentionMs)]) : unsent;
    });
  const rows = await query.execute();
  await remove(deps, rows.map((r) => r.id));
  return rows.length;
}
