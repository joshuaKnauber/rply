import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { syncAdminToken } from "./auth.ts";
import { openDatabase } from "./db/index.ts";
import { createNotifier } from "./notifier.ts";

const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.RPLY_DB ?? "rply.db";
const webDir = process.env.RPLY_WEB_DIR ?? fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));

const db = await openDatabase(dbPath);
await syncAdminToken(db, process.env.RPLY_ADMIN_TOKEN);

const app = createApp({ db, notifier: createNotifier() }, { webDir });
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`rply server listening on :${info.port} (db: ${dbPath})`);
  if (!process.env.RPLY_ADMIN_TOKEN) console.log("RPLY_ADMIN_TOKEN is not set, anyone can create channels");
});

const shutdown = () => server.close(() => db.destroy().then(() => process.exit(0)));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
