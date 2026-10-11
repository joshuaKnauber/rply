import type { Command } from "commander";
import type { Message } from "@rply/schema";
import { CliError } from "../client.ts";
import { connect, json } from "../context.ts";
import { printJson, readJson } from "../io.ts";
import { attachmentBlocks, collect } from "./files.ts";
import { parseBlocks } from "./messages.ts";

type BodyOptions = { title?: string; blocks?: string; image?: string[]; file?: string[] };

export function registerPins(program: Command) {
  const pin = program
    .command("pin")
    .description("manage messages pinned to the top of the chat, e.g. a live overview (each has a key)");

  pin
    .command("set")
    .allowUnknownOption()
    .description("create or replace the pinned message with this key")
    .argument("<key>", "short name, e.g. overview")
    .argument("[text]", "text, markdown supported")
    .option("--title <title>", "bold title")
    .option("--blocks <json|file|->", "blocks as a JSON array, a file path, or - for stdin")
    .option("--image <path>", "attach an image (repeatable)", collect, [])
    .option("--file <path>", "attach a file (repeatable)", collect, [])
    .action((key: string, text: string | undefined, opts: BodyOptions) => setPin(key, text, opts));

  pin
    .command("patch")
    .allowUnknownOption()
    .description("update the pinned message with this key, e.g. one progress block")
    .argument("<key>")
    .argument("[text]", "new text")
    .option("--title <title>", "new title")
    .option("--patch <json|file|->", 'update blocks by id, e.g. \'{"id":"pages","value":42}\'')
    .action((key: string, text: string | undefined, opts: { title?: string; patch?: string }) => patchPin(key, text, opts));

  pin
    .command("remove")
    .description("unpin and delete the message with this key")
    .argument("<key>")
    .action(async (key: string) => {
      await connect().client.request("DELETE", `/pins/${key}`);
      if (!json()) console.log(`Unpinned "${key}"`);
    });

  pin
    .command("list")
    .description("list pinned messages")
    .action(async () => {
      const { messages } = await connect().client.request<{ messages: Message[] }>("GET", "/pins");
      if (json()) return printJson(messages);
      if (messages.length === 0) return console.log("Nothing pinned.");
      for (const m of messages) {
        const summary = m.enc ? "(encrypted)" : ("title" in m.body && m.body.title) || ("text" in m.body && m.body.text) || "(blocks)";
        console.log(`${m.pin}  ${summary}`);
      }
    });

  const status = program.command("status").description('shortcut for the pinned message with key "status"');

  status
    .command("set")
    .description("replace the status message")
    .argument("<json|file|->", "a blocks array or { blocks: [...] }, as JSON, a file path, or - for stdin")
    .action((source: string) => setPin("status", undefined, { blocks: source }));

  status
    .command("patch")
    .description("update status blocks by id, e.g. '{\"id\":\"pages\",\"value\":42}'")
    .argument("<json|file|->", "one patch object or an array of them, each with an id")
    .action((source: string) => patchPin("status", undefined, { patch: source }));

  status
    .command("get")
    .description("print the status message body as JSON")
    .action(async () => {
      const { messages } = await connect().client.request<{ messages: Message[] }>("GET", "/pins");
      printJson(messages.find((m) => m.pin === "status")?.body ?? null);
    });
}

async function setPin(key: string, text: string | undefined, opts: BodyOptions) {
  const blocks = [...(opts.blocks ? parseBlocks(readJson(opts.blocks)) : []), ...(await attachmentBlocks(opts))];
  if (!text && blocks.length === 0 && !opts.title) throw new CliError("Nothing to pin, pass text, --title, --blocks, --image or --file");
  const { message } = await connect().client.request<{ message: Message }>("PUT", `/pins/${key}`, {
    body: { title: opts.title, text, blocks: blocks.length ? blocks : undefined },
  });
  report(message);
}

async function patchPin(key: string, text: string | undefined, opts: { title?: string; patch?: string }) {
  const patch = opts.patch ? readJson(opts.patch) : undefined;
  const body = { text, title: opts.title, block_patches: patch === undefined ? undefined : Array.isArray(patch) ? patch : [patch] };
  if (Object.values(body).every((v) => v === undefined)) throw new CliError("Nothing to change, pass text, --title or --patch");
  const { message } = await connect().client.request<{ message: Message }>("PATCH", `/pins/${key}`, body);
  report(message);
}

function report(message: Message) {
  if (json()) return printJson(message);
  console.log(`Pinned "${message.pin}" updated`);
}
