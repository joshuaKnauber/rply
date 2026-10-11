import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { syncAdminToken } from "./auth.ts";
import { openDatabase } from "./db/index.ts";
import { filesConfigFromEnv } from "./files/config.ts";
import { sweepFiles } from "./files/manage.ts";
import { createNotifier } from "./notifier.ts";

const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.RPLY_DB ?? "rply.db";
const webDir = process.env.RPLY_WEB_DIR ?? fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));

const db = await openDatabase(dbPath);
await syncAdminToken(db, process.env.RPLY_ADMIN_TOKEN);

const files = filesConfigFromEnv(process.env, dbPath);
const deps = { db, notifier: createNotifier(), files };
const app = createApp(deps, { webDir });
const sweep = () => sweepFiles(deps).catch((err) => console.error("file cleanup failed", err));
sweep();
const sweeper = setInterval(sweep, 60 * 60 * 1000);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`rply server listening on :${info.port} (db: ${dbPath})`);
  if (!process.env.RPLY_ADMIN_TOKEN) console.log("RPLY_ADMIN_TOKEN is not set, anyone can create channels");
  console.log(files ? `files: ${files.store.name} (max ${Math.round(files.maxSize / 1024 / 1024)} MB per file)` : "files: off");
});

const shutdown = () => {
  clearInterval(sweeper);
  server.close(() => db.destroy().then(() => process.exit(0)));
  if ("closeAllConnections" in server) server.closeAllConnections();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
