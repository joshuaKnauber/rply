import { randomBytes } from "node:crypto";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { bearer, magicLink } from "better-auth/plugins";
import type { OAuthProvider, Registration } from "@rply/schema";
import { isPostgres } from "./db/dialect.ts";
import type { DB } from "./db/index.ts";
import type { EmailSender } from "./email.ts";

export type AccountsOptions = {
  url?: string;
  registration?: string;
  email?: EmailSender | null;
  secret?: string;
  trustedOrigins?: string[];
  oauth?: Partial<Record<OAuthProvider, OAuthCredentials>>;
  beforeDeleteUser?: (userId: string) => Promise<void>;
};
export type OAuthCredentials = { clientId: string; clientSecret: string };
export type Accounts = Awaited<ReturnType<typeof createAccounts>>;

// both values or neither, so a half-configured provider fails at start instead of at sign-in
export function oauthFromEnv(env: Record<string, string | undefined>) {
  const oauth: Partial<Record<OAuthProvider, OAuthCredentials>> = {};
  for (const provider of ["github", "google"] as const) {
    const prefix = `RPLY_${provider.toUpperCase()}`;
    const clientId = env[`${prefix}_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CLIENT_SECRET`];
    if (!clientId && !clientSecret) continue;
    if (!clientId || !clientSecret) throw new Error(`${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET must be set together`);
    oauth[provider] = { clientId, clientSecret };
  }
  return oauth;
}

const REGISTRATION_MODES: Registration[] = ["open", "invite", "closed"];

function parseRegistration(value = "invite") {
  if (!REGISTRATION_MODES.includes(value as Registration)) throw new Error(`RPLY_REGISTRATION must be one of ${REGISTRATION_MODES.join(", ")}`);
  return value as Registration;
}

async function authSecret(db: DB, secret: string | undefined) {
  if (secret) return secret;
  const stored = await db.selectFrom("settings").select("value").where("key", "=", "auth_secret").executeTakeFirst();
  if (stored) return stored.value;
  const value = randomBytes(32).toString("base64url");
  await db.insertInto("settings").values({ key: "auth_secret", value }).execute();
  return value;
}

export async function createAccounts(db: DB, opts: AccountsOptions = {}) {
  const email = opts.email ?? null;
  const registration = parseRegistration(opts.registration);
  if (email && !opts.url) throw new Error("RPLY_URL is required for email, since the links in it point there");
  const oauth = opts.oauth ?? {};
  const oauthProviders = Object.keys(oauth) as OAuthProvider[];
  if (oauthProviders.length && !opts.url) throw new Error("RPLY_URL is required for GitHub and Google sign-in, since the providers redirect back there");
  const url = opts.url ? new URL(opts.url) : null;
  const hasUsers = async () => Boolean(await db.selectFrom("user").select("id").limit(1).executeTakeFirst());

  const auth = betterAuth({
    appName: "rply",
    baseURL: url?.origin,
    basePath: "/v1/auth",
    // other origins allowed to call the auth routes, e.g. the Expo web build in development
    trustedOrigins: opts.trustedOrigins,
    secret: await authSecret(db, opts.secret),
    database: { db, type: isPostgres(db) ? "postgres" : "sqlite" },
    telemetry: { enabled: false },
    advanced: { cookiePrefix: "rply" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: Boolean(email),
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: email
        ? ({ user, url }) => email({ to: user.email, subject: "Reset your rply password", text: `Reset your password: ${url}\n\nIgnore this email if you didn't ask for it.` })
        : undefined,
    },
    socialProviders: oauth,
    emailVerification: email
      ? {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: ({ user, url }) => email({ to: user.email, subject: "Confirm your email for rply", text: `Confirm your email: ${url}` }),
        }
      : undefined,
    // needs the password or a session from the last day; owned channels go first (memberships, sessions and push cascade)
    user: { deleteUser: { enabled: true, beforeDelete: async (user) => opts.beforeDeleteUser?.(user.id) } },
    databaseHooks: {
      user: {
        create: {
          // the first user sets the server up; after that only open registration lets new people in (invites come later)
          before: async () => {
            if (registration !== "open" && (await hasUsers())) throw new APIError("FORBIDDEN", { message: "Registration is closed on this server" });
          },
        },
      },
    },
    plugins: [
      bearer(),
      ...(url ? [passkey({ rpID: url.hostname, rpName: "rply", origin: url.origin })] : []),
      ...(email ? [magicLink({ sendMagicLink: ({ email: to, url }) => email({ to, subject: "Sign in to rply", text: `Sign in: ${url}\n\nThe link works once and expires in 5 minutes.` }) })] : []),
    ],
  });

  return {
    handler: auth.handler,
    api: auth.api,
    context: auth.$context,
    hasUsers,
    info: { registration, email: Boolean(email), passkeys: Boolean(url), oauth: oauthProviders },
    user: async (headers: Headers) => (await auth.api.getSession({ headers }))?.user ?? null,
  };
}
