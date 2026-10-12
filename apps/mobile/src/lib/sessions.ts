import { api, ApiError, normalizeServer } from "./api";
import { createStore } from "./store";

// one bearer session per server (better-auth's bearer plugin), kept in SecureStore
export type Session = { server: string; token: string; email: string };

export const DEFAULT_SERVER = "https://rply.sh";

const sessions = createStore<Session[]>("rply.sessions", []);

export const loadSessions = sessions.load;
export const useSessions = sessions.use;
export const getSessions = sessions.get;

export async function signIn(serverInput: string, email: string, password: string, create: boolean) {
  const server = normalizeServer(serverInput);
  const res = await fetch(`${server}/v1/auth/${create ? "sign-up" : "sign-in"}/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, ...(create && { name: email.split("@")[0] }) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.message ?? json.error ?? `Sign-in failed (${res.status})`, res.status);
  const token = res.headers.get("set-auth-token");
  if (!token) throw new Error("Check your email to confirm your address, then sign in.");
  sessions.update((all) => [...all.filter((s) => s.server !== server), { server, token, email }]);
}

export const forgetSession = (server: string) => sessions.update((all) => all.filter((s) => s.server !== server));

export async function signOut(session: Session) {
  await api(session.server, "/auth/sign-out", { token: session.token, body: {} }).catch(() => undefined);
  forgetSession(session.server);
}

export async function deleteAccount(session: Session, password: string) {
  await api(session.server, "/auth/delete-user", { token: session.token, body: password ? { password } : {} });
  forgetSession(session.server);
}
