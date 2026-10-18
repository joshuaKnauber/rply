import type { Command } from "commander";
import { CliError } from "../client.ts";
import { json } from "../context.ts";
import { printJson } from "../io.ts";
import { VERSION } from "../update.ts";

// Goes to the rply developers on rply.sh, whichever server this machine uses.
const FEEDBACK_URL = process.env.RPLY_FEEDBACK_URL ?? "https://app.rply.sh/v1/feedback";

export function registerFeedback(program: Command) {
  program
    .command("feedback")
    .allowUnknownOption()
    .description("tell the rply developers what to improve or what's missing (sent to rply.sh)")
    .argument("<text>")
    .action(async (text: string) => {
      const body = { text, from: "agent", version: VERSION };
      const res = await fetch(FEEDBACK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) }).catch((err: Error) => {
        throw new CliError(`Couldn't send feedback: ${err.message}`);
      });
      if (!res.ok) throw new CliError(`Couldn't send feedback: ${((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.status}`);
      if (json()) return printJson({ sent: body });
      console.log(`Sent to the rply developers (${FEEDBACK_URL}):\n${text}\nThanks!`);
    });
}
