import { existsSync } from "node:fs";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Deps } from "./context.ts";
import { adminRoutes } from "./routes/admin.ts";
import { callRoutes } from "./routes/calls.ts";
import { channelRoutes } from "./routes/channels.ts";
import { fileRoutes } from "./routes/files.ts";
import { messageRoutes } from "./routes/messages.ts";
import { pinRoutes } from "./routes/pins.ts";
import { pushRoutes } from "./routes/push.ts";
import { secretRoutes } from "./routes/secrets.ts";
import { syncRoutes } from "./routes/sync.ts";
import { createServes } from "./serves.ts";

const CALL_RESULT = /^\/v1\/calls\/[^/]+\/result$/;

export function createApp(deps: Deps, opts: { webDir?: string } = {}) {
  const serves = createServes();
  const api = new Hono<AppEnv>()
    .use(cors({ origin: "*", allowHeaders: ["authorization", "content-type", "x-rply-channel"] }))
    .use((c, next) => {
      if (c.req.method === "POST" && c.req.path === "/v1/files") return next();
      return bodyLimit({ maxSize: CALL_RESULT.test(c.req.path) ? 5 * 1024 * 1024 : 256 * 1024 })(c, next);
    })
    .route("/", adminRoutes(deps))
    .route("/", channelRoutes(deps, serves))
    .route("/", syncRoutes(deps))
    .route("/", pinRoutes(deps))
    .route("/", secretRoutes(deps))
    .route("/", fileRoutes(deps))
    .route("/", pushRoutes(deps))
    .route("/", callRoutes(deps, serves))
    .route("/", messageRoutes(deps));

  const app = new Hono()
    .get("/health", (c) => c.json({ ok: true }))
    .route("/v1", api)
    .all("/v1/*", (c) => c.json({ error: "Not found" }, 404));

  if (opts.webDir && existsSync(opts.webDir)) {
    app.use("*", serveStatic({ root: opts.webDir }));
    app.get("*", serveStatic({ root: opts.webDir, path: "index.html" }));
  }

  return app.onError((err, c) => {
      if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error(err);
      return c.json({ error: "Internal server error" }, 500);
    });
}
