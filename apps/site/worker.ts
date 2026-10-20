const plausible = "https://nudge-events.up.railway.app";

type Env = { ASSETS: { fetch: (request: Request) => Promise<Response> } };

export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/_r/s.js") return fetch(`${plausible}/js/script.tagged-events.js`, { cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit);
    if (pathname === "/_r/e" && request.method === "POST") {
      return fetch(`${plausible}/api/event`, {
        method: "POST",
        body: request.body,
        headers: {
          "content-type": request.headers.get("content-type") ?? "text/plain",
          "user-agent": request.headers.get("user-agent") ?? "",
          "x-forwarded-for": request.headers.get("cf-connecting-ip") ?? "",
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
