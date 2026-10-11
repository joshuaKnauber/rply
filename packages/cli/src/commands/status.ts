import type { Command } from "commander";
import type { Message } from "@rply/schema";
import { CliError } from "../client.ts";
import { connect, json } from "../context.ts";
import { printJson, readJson } from "../io.ts";

export function registerStatus(program: Command) {
  const status = program.command("status").description("manage the channel's status page");

  status
    .command("set")
    .description("replace the status page")
    .argument("<json|file|->", "a blocks array or { blocks: [...] }, as JSON, a file path, or - for stdin")
    .action(async (source: string) => {
      const input = readJson(source);
      const blocks = Array.isArray(input) ? input : (input as { blocks?: unknown }).blocks;
      if (!Array.isArray(blocks)) throw new CliError("Expected a blocks array or an object with a blocks array");
      report(await connect().client.request<{ status: Message }>("PUT", "/status", { body: { blocks } }));
    });

  status
    .command("patch")
    .description("update blocks by id, e.g. '{\"id\":\"pages\",\"value\":42}'")
    .argument("<json|file|->", "one patch object or an array of them, each with an id")
    .action(async (source: string) => {
      const input = readJson(source);
      const blocks = Array.isArray(input) ? input : [input];
      report(await connect().client.request<{ status: Message }>("PATCH", "/status", { blocks }));
    });

  status
    .command("get")
    .description("print the current status page as JSON")
    .action(async () => {
      const { status } = await connect().client.request<{ status: Message | null }>("GET", "/status");
      printJson(status?.body ?? null);
    });
}

function report({ status }: { status: Message }) {
  if (json()) return printJson(status);
  console.log("Status page updated");
}
