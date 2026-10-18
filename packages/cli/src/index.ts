#!/usr/bin/env node
import { Command } from "commander";
import { CliError } from "./client.ts";
import { registerApps } from "./commands/apps.ts";
import { registerAsks } from "./commands/asks.ts";
import { registerFeedback } from "./commands/feedback.ts";
import { registerFiles } from "./commands/files.ts";
import { guideHint, registerGuide } from "./commands/guide.ts";
import { registerMessages } from "./commands/messages.ts";
import { registerSetup } from "./commands/setup.ts";
import { registerPins } from "./commands/pins.ts";
import { registerSecrets } from "./commands/secrets.ts";
import { registerServe } from "./commands/serve.ts";
import { setGlobalOptions } from "./context.ts";
import { checkForUpdate, registerUpdate, updateNotice, VERSION } from "./update.ts";

const program = new Command()
  .name("rply")
  .description("Talk to the human behind your agent: send updates, ask questions, publish a status page.\nAgents: run `rply guide` first.")
  .version(VERSION)
  .option("--json", "machine-readable JSON output")
  .option("--channel <name>", "which local channel to use (default: the one marked with * in `rply channels`, or RPLY_CHANNEL)")
  .hook("preAction", (_program, action) => {
    setGlobalOptions(action.optsWithGlobals());
  });

registerGuide(program);
registerSetup(program);
registerMessages(program);
registerAsks(program);
registerFiles(program);
registerPins(program);
registerApps(program);
registerServe(program);
registerSecrets(program);
registerFeedback(program);
registerUpdate(program);

const update = checkForUpdate().catch(() => undefined);
let exitCode = 0;
try {
  await program.parseAsync();
} catch (err) {
  console.error(`rply: ${(err as Error).message}`);
  exitCode = err instanceof CliError ? err.exitCode : 1;
}
const latest = await update;
if (latest) console.error(updateNotice(latest));
const hint = guideHint();
if (hint) console.error(hint);
process.exit(exitCode);
