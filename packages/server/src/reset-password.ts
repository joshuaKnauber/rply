import { randomBytes } from "node:crypto";
import { createAccounts } from "./accounts.ts";
import { databaseFromEnv, openDatabase } from "./db/index.ts";

// For servers without email: node packages/server/src/reset-password.ts <email>
const email = process.argv[2];
if (!email) {
  console.error("Usage: node packages/server/src/reset-password.ts <email>");
  process.exit(1);
}

const db = await openDatabase(databaseFromEnv(process.env));
const accounts = await createAccounts(db, { secret: process.env.RPLY_AUTH_SECRET });
const ctx = await accounts.context;
const found = await ctx.internalAdapter.findUserByEmail(email.toLowerCase());
if (!found) {
  console.error(`No account for ${email}`);
  process.exit(1);
}

const password = randomBytes(12).toString("base64url");
const hash = await ctx.password.hash(password);
if (await ctx.internalAdapter.findCredentialAccount(found.user.id)) await ctx.internalAdapter.updatePassword(found.user.id, hash);
else await ctx.internalAdapter.linkAccount({ userId: found.user.id, providerId: "credential", accountId: found.user.id, password: hash });
await ctx.internalAdapter.deleteUserSessions(found.user.id);
await db.destroy();
console.log(`New password for ${found.user.email}: ${password}\nAll of their sessions were signed out. Change it after signing in.`);
