import { createAccounts } from "./accounts.ts";
import { databaseFromEnv, isPostgresUrl, openDatabase } from "./db/index.ts";
import { filesConfigFromEnv } from "./files/config.ts";
import { createLimits } from "./limits.ts";
import { createNotifier } from "./notifier.ts";
import { deleteOwnedChannels } from "./routes/channels.ts";

// For removing an account by hand, e.g. abuse: node packages/server/src/delete-user.ts <email>
const email = process.argv[2];
if (!email) {
  console.error("Usage: node packages/server/src/delete-user.ts <email>");
  process.exit(1);
}

const target = databaseFromEnv(process.env);
const db = await openDatabase(target);
const accounts = await createAccounts(db, { secret: process.env.RPLY_AUTH_SECRET });
const deps = { db, notifier: createNotifier(), accounts, limits: createLimits(db), files: filesConfigFromEnv(process.env, isPostgresUrl(target) ? null : target) };
const ctx = await accounts.context;
const found = await ctx.internalAdapter.findUserByEmail(email.toLowerCase());
if (!found) {
  console.error(`No account for ${email}`);
  process.exit(1);
}

const owned = await db.selectFrom("channel_members").select("channel_id").where("user_id", "=", found.user.id).where("role", "=", "owner").execute();
await deleteOwnedChannels(deps, found.user.id);
await ctx.internalAdapter.deleteUser(found.user.id);
await db.destroy();
console.log(`Deleted ${found.user.email} and the ${owned.length} channel${owned.length === 1 ? "" : "s"} it owned. Its agents can no longer connect.`);
