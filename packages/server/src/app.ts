import { existsSync } from "node:fs";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Deps } from "./context.ts";
import { adminRoutes } from "./routes/admin.ts";
import { channelRoutes } from "./routes/channels.ts";
import { fileRoutes } from "./routes/files.ts";
import { messageRoutes } from "./routes/messages.ts";
import { pinRoutes } from "./routes/pins.ts";
import { secretRoutes } from "./routes/secrets.ts";
import { syncRoutes } from "./routes/sync.ts";

export function createApp(deps: Deps, opts: { webDir?: string } = {}) {
  const api = new Hono<AppEnv>()
    .use(cors({ origin: "*", allowHeaders: ["authorization", "content-type", "x-rply-channel"] }))
    .use((c, next) => (c.req.method === "POST" && c.req.path === "/v1/files" ? next() : bodyLimit({ maxSize: 256 * 1024 })(c, next)))
    .route("/", adminRoutes(deps))
    .route("/", channelRoutes(deps))
    .route("/", syncRoutes(deps))
    .route("/", pinRoutes(deps))
    .route("/", secretRoutes(deps))
    .route("/", fileRoutes(deps))
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
