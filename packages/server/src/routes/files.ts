import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { INLINE_IMAGE_TYPES, type FileInfo } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import type { AppEnv, Deps } from "../context.ts";
import { now, randomId } from "../tokens.ts";

const disposition = (kind: "inline" | "attachment", name: string) =>
  `${kind}; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;

export function fileRoutes(deps: Deps) {
  const { db, files } = deps;
  const auth = requireAuth(deps);
  const enabled = () => {
    if (!files) throw new HTTPException(404, { message: "File attachments are turned off on this server" });
    return files;
  };

  return new Hono<AppEnv>()
    .post(
      "/files",
      auth,
      (c, next) =>
        bodyLimit({
          maxSize: enabled().maxSize,
          onError: (c) => c.json({ error: `Files can be at most ${Math.round(enabled().maxSize / 1024 / 1024)} MB` }, 413),
        })(c, next),
      async (c) => {
        const config = enabled();
        const { channel, sender } = c.var.auth;
        const name = (c.req.query("name") ?? "file").slice(0, 255) || "file";
        const mime = (c.req.header("content-type") ?? "application/octet-stream").split(";")[0]!.trim().toLowerCase().slice(0, 255);
        const bytes = new Uint8Array(await c.req.arrayBuffer());
        if (bytes.byteLength === 0) throw new HTTPException(400, { message: "Empty file" });

        const { used } = await db
          .selectFrom("files")
          .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("size"), eb.lit(0)).as("used"))
          .where("deleted_at", "is", null)
          .executeTakeFirstOrThrow();
        if (Number(used) + bytes.byteLength > config.totalLimit) throw new HTTPException(507, { message: "This server's file storage is full" });

        const id = randomId();
        await config.store.put(id, bytes, mime);
        const created_at = now();
        await db
          .insertInto("files")
          .values({ id, channel_id: channel.id, message_id: null, uploader: sender, name, mime, size: bytes.byteLength, created_at, deleted_at: null })
          .execute();
        const file: FileInfo = { file_id: id, name, mime, size: bytes.byteLength, created_at };
        return c.json({ file }, 201);
      },
    )
    .get("/files/:id", auth, async (c) => {
      const config = enabled();
      const row = await db
        .selectFrom("files")
        .selectAll()
        .where("id", "=", c.req.param("id"))
        .where("channel_id", "=", c.var.auth.channel.id)
        .executeTakeFirst();
      if (!row) throw new HTTPException(404, { message: "File not found" });
      if (row.deleted_at) throw new HTTPException(410, { message: "This file is no longer available" });

      const inline = INLINE_IMAGE_TYPES.includes(row.mime);
      const headers = {
        contentType: inline ? row.mime : "application/octet-stream",
        disposition: disposition(inline ? "inline" : "attachment", row.name),
      };
      const download = await config.store.download(row.id, headers);
      if (!download) throw new HTTPException(410, { message: "This file is no longer available" });
      if (download.kind === "redirect") return c.redirect(download.url, 302);

      return new Response(download.body, {
        headers: {
          "content-type": headers.contentType,
          "content-disposition": headers.disposition,
          "content-length": String(download.size),
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
          "cache-control": "private, max-age=86400",
        },
      });
    });
}
