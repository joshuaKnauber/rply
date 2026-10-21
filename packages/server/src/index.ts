import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { emailFromEnv } from "./email.ts";
import { createAccounts, oauthFromEnv } from "./accounts.ts";
import { createLimits, quotasFromEnv } from "./limits.ts";
import { databaseFromEnv, isPostgresUrl, openDatabase } from "./db/index.ts";
import { filesConfigFromEnv } from "./files/config.ts";
import { sweepFiles } from "./files/manage.ts";
import { createNotifier } from "./notifier.ts";
import { createPush } from "./push/index.ts";
import { sweepOldMessages } from "./messages.ts";
import { deleteOwnedChannels, sweepUnclaimed } from "./routes/channels.ts";

const port = Number(process.env.PORT ?? 8080);
const dbTarget = databaseFromEnv(process.env);
const dbPath = isPostgresUrl(dbTarget) ? null : dbTarget;
const webDir = process.env.RPLY_WEB_DIR ?? fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));

const db = await openDatabase(dbTarget);
const accounts = await createAccounts(db, {
  url: process.env.RPLY_URL,
  registration: process.env.RPLY_REGISTRATION,
  email: emailFromEnv(process.env),
  secret: process.env.RPLY_AUTH_SECRET,
  oauth: oauthFromEnv(process.env),
  trustedOrigins: process.env.RPLY_TRUSTED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean),
  beforeDeleteUser: (userId) => deleteOwnedChannels(deps, userId),
});

const files = filesConfigFromEnv(process.env, dbPath);
const push = process.env.RPLY_PUSH === "off" ? null : await createPush(db, { env: process.env });
const limits = createLimits(db, quotasFromEnv(process.env));
const deps = { db, notifier: createNotifier(), accounts, limits, files, push, feedbackChannel: process.env.RPLY_FEEDBACK_CHANNEL || null };
const app = createApp(deps, { webDir });
// logs only runs that deleted something
const sweep = () => {
  sweepFiles(deps).then(
    (n) => n && console.log(`cleanup: deleted ${n} expired or unattached file${n === 1 ? "" : "s"}`),
    (err) => console.error("file cleanup failed", err),
  );
  sweepUnclaimed(deps).then(
    (n) => n && console.log(`cleanup: deleted ${n} unclaimed channel${n === 1 ? "" : "s"}`),
    (err) => console.error("channel cleanup failed", err),
  );
  sweepOldMessages(deps).then(
    ({ messages, files }) => messages && console.log(`retention: deleted ${messages} message${messages === 1 ? "" : "s"} and ${files} file${files === 1 ? "" : "s"}`),
    (err) => console.error("message cleanup failed", err),
  );
};
sweep();
const sweeper = setInterval(sweep, 10 * 60 * 1000);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`rply server listening on :${info.port} (db: ${dbPath ?? "postgres"})`);
  console.log(`accounts: registration ${accounts.info.registration}${accounts.info.email ? ", email on" : ", email off"}${accounts.info.passkeys ? ", passkeys on" : " (set RPLY_URL for passkeys)"}${accounts.info.oauth.map((p) => `, ${p} on`).join("")}`);
  console.log(push ? "push: web push enabled" : "push: off");
  if (deps.feedbackChannel) console.log(`feedback: collected in channel ${deps.feedbackChannel}`);
  console.log(files ? `files: ${files.store.name} (max ${Math.round(files.maxSize / 1024 / 1024)} MB per file)` : "files: off");
});

const shutdown = () => {
  clearInterval(sweeper);
  server.close(() => db.destroy().then(() => process.exit(0)));
  if ("closeAllConnections" in server) server.closeAllConnections();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
