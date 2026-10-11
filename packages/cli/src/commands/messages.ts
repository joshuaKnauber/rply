import type { Command } from "commander";
import type { AgentMessageBody, Block, Message, MessagesResponse } from "@rply/schema";
import { CliError } from "../client.ts";
import { saveCursor } from "../config.ts";
import { connect, json } from "../context.ts";
import { deadlineFrom, printJson, readJson } from "../io.ts";

export function registerMessages(program: Command) {
  program
    .command("send")
    .allowUnknownOption()
    .description("send a message to the human")
    .argument("[text]", "message text, markdown supported")
    .option("--title <title>", "bold title above the text")
    .option("--blocks <json|file|->", "blocks as a JSON array, a file path, or - for stdin")
    .action(async (text: string | undefined, opts: { title?: string; blocks?: string }) => {
      const blocks = opts.blocks ? parseBlocks(readJson(opts.blocks)) : undefined;
      if (!text && !blocks) throw new CliError("Nothing to send, pass text or --blocks");
      const message = await post({ title: opts.title, text, blocks });
      if (json()) return printJson(message);
      console.log(`Sent (id: ${message.id})`);
    });

  program
    .command("edit")
    .allowUnknownOption()
    .description("change a message you sent, e.g. to update progress")
    .argument("<message-id>")
    .argument("[text]", "new text")
    .option("--title <title>", "new title")
    .option("--blocks <json|file|->", "replace all blocks")
    .option("--patch <json|file|->", 'update blocks by id, e.g. \'{"id":"progress","value":7}\'')
    .action(async (id: string, text: string | undefined, opts: { title?: string; blocks?: string; patch?: string }) => {
      const patch = opts.patch ? readJson(opts.patch) : undefined;
      const body = {
        text,
        title: opts.title,
        blocks: opts.blocks ? parseBlocks(readJson(opts.blocks)) : undefined,
        block_patches: patch === undefined ? undefined : Array.isArray(patch) ? patch : [patch],
      };
      if (Object.values(body).every((v) => v === undefined)) throw new CliError("Nothing to change, pass text, --title, --blocks or --patch");
      const { message } = await connect().client.request<{ message: Message }>("PATCH", `/messages/${id}`, body);
      if (json()) return printJson(message);
      console.log(`Updated (id: ${message.id})`);
    });

  program
    .command("delete")
    .description("delete a message you sent (an unanswered question is withdrawn)")
    .argument("<message-id>")
    .action(async (id: string) => {
      await connect().client.request("DELETE", `/messages/${id}`);
      if (!json()) console.log("Deleted");
    });

  program
    .command("ack")
    .description("tell the human you've seen a message, are working on it, or are done")
    .argument("<message-id>", "id shown by rply inbox")
    .argument("[state]", "seen, working or done", "working")
    .action(async (id: string, state: string) => {
      if (!["seen", "working", "done"].includes(state)) throw new CliError("state must be seen, working or done");
      const { message } = await connect().client.request<{ message: Message }>("POST", `/messages/${id}/state`, { state });
      if (json()) return printJson(message);
      console.log(`Marked as ${state}`);
    });

  program
    .command("inbox")
    .description("print new messages from the human and mark them as seen (answers to questions come through ask/wait)")
    .option("--wait", "block until at least one message arrives")
    .option("--timeout <duration>", "give up waiting after e.g. 10m (exit code 2)")
    .option("--since <seq>", "start after this cursor instead of the stored one")
    .option("--peek", "don't mark messages as seen")
    .action(async (opts: { wait?: boolean; timeout?: string; since?: string; peek?: boolean }) => {
      const { client, selected } = connect();
      let cursor = opts.since !== undefined ? Number(opts.since) : (selected.config.inbox_cursor ?? 0);
      const deadline = opts.wait ? deadlineFrom(opts.timeout) : Date.now() + 1;

      const messages = await client.poll(deadline, async (waitSeconds) => {
        const peek = opts.peek ? "&peek=1" : "";
        const res = await client.once<MessagesResponse>("GET", `/messages?sender=human&since=${cursor}&wait=${opts.wait ? waitSeconds : 0}${peek}`);
        cursor = res.cursor;
        if (!opts.peek) saveCursor(selected, cursor);
        const fresh = res.messages.filter((m) => !m.reply_to);
        return fresh.length || !opts.wait ? fresh : undefined;
      });

      if (messages === undefined) throw new CliError("Timed out waiting for messages", 2);
      if (messages.length === 0 && !json()) return console.log("No new messages.");
      messages.forEach(printMessage);
      if (messages.length && !json()) console.log("\nAcknowledge with: rply ack <id> working|done");
    });

  program
    .command("listen")
    .description("stream messages from the human as they arrive (Ctrl+C to stop)")
    .action(async () => {
      const { client, selected } = connect();
      let cursor = selected.config.inbox_cursor ?? 0;
      await client.poll(undefined, async (waitSeconds) => {
        const res = await client.once<MessagesResponse>("GET", `/messages?sender=human&since=${cursor}&wait=${waitSeconds}`);
        cursor = res.cursor;
        saveCursor(selected, cursor);
        res.messages.filter((m) => !m.reply_to).forEach(printMessage);
        return undefined;
      });
    });
}

export async function post(body: AgentMessageBody, extra: { ask?: { expires_at?: number } } = {}) {
  const { client } = connect();
  const { message } = await client.request<{ message: Message }>("POST", "/messages", { body, ...extra });
  return message;
}

export function parseBlocks(input: unknown): Block[] {
  const blocks = Array.isArray(input) ? input : (input as { blocks?: unknown })?.blocks;
  if (!Array.isArray(blocks)) throw new CliError("Blocks must be a JSON array or an object with a blocks array");
  return blocks;
}

function printMessage(message: Message) {
  if (json()) return printJson(message);
  const time = new Date(message.created_at).toLocaleString();
  const text = message.enc ? "(encrypted)" : ("text" in message.body && message.body.text) || JSON.stringify(message.body);
  console.log(`[${time}] (${message.id}) ${text}`);
}
