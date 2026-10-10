import type { Command } from "commander";
import type { AgentMessageBody, Block, Message, MessagesResponse } from "@rply/schema";
import { CliError } from "../client.ts";
import { readConfig, saveCursor } from "../config.ts";
import { connect, json } from "../context.ts";
import { deadlineFrom, printJson, readJson } from "../io.ts";

const FREE_TEXT_ID = "answer";

export function registerMessages(program: Command) {
  program
    .command("send")
    .description("send a message to the human")
    .argument("[text]", "message text, markdown supported")
    .option("--title <title>", "bold title above the text")
    .option("--blocks <json|file|->", "extra blocks as a JSON array, a file path, or - for stdin")
    .action(async (text: string | undefined, opts: { title?: string; blocks?: string }) => {
      const blocks = opts.blocks ? parseBlocks(readJson(opts.blocks)) : undefined;
      if (!text && !blocks) throw new CliError("Nothing to send, pass text or --blocks");
      const message = await post({ title: opts.title, text, blocks });
      if (json()) return printJson(message);
      console.log(`Sent (id: ${message.id})`);
    });

  program
    .command("ask")
    .description("ask the human a question; without --buttons or --form they get a text field")
    .argument("<question>", "the question, markdown supported")
    .option("--buttons <choices>", 'comma-separated choices, e.g. "Yes,No"')
    .option("--form <json|file|->", "form fields as a JSON array (or a full form block)")
    .option("--wait", "block until answered and print the answer")
    .option("--timeout <duration>", "give up waiting after e.g. 30m (exit code 2)")
    .action(async (question: string, opts: { buttons?: string; form?: string; wait?: boolean; timeout?: string }) => {
      const message = await post({ text: question, blocks: [askBlock(opts)] });
      if (!opts.wait) {
        if (json()) return printJson(message);
        return console.log(`Asked (id: ${message.id}). Get the answer with: rply wait ${message.id}`);
      }
      await waitForAnswer(message.id, opts.timeout);
    });

  program
    .command("wait")
    .description("wait for the answer to an earlier ask")
    .argument("<message-id>", "id printed by rply ask")
    .option("--timeout <duration>", "give up after e.g. 30m (exit code 2)")
    .action((id: string, opts: { timeout?: string }) => waitForAnswer(id, opts.timeout));

  program
    .command("inbox")
    .description("print new messages from the human (not answers to asks) and mark them as read")
    .option("--wait", "block until at least one message arrives")
    .option("--timeout <duration>", "give up waiting after e.g. 10m (exit code 2)")
    .option("--since <seq>", "start after this cursor instead of the stored one")
    .option("--peek", "don't mark messages as read")
    .action(async (opts: { wait?: boolean; timeout?: string; since?: string; peek?: boolean }) => {
      const { client } = connect();
      let cursor = opts.since !== undefined ? Number(opts.since) : (readConfig()?.inbox_cursor ?? 0);
      const deadline = opts.wait ? deadlineFrom(opts.timeout) : Date.now() + 1;

      const messages = await client.poll(deadline, async (waitSeconds) => {
        const res = await client.once<MessagesResponse>("GET", `/messages?sender=human&since=${cursor}&wait=${opts.wait ? waitSeconds : 0}`);
        cursor = res.cursor;
        if (!opts.peek) saveCursor(cursor);
        const fresh = res.messages.filter((m) => !m.reply_to);
        return fresh.length || !opts.wait ? fresh : undefined;
      });

      if (messages === undefined) throw new CliError("Timed out waiting for messages", 2);
      if (messages.length === 0 && !json()) return console.log("No new messages.");
      messages.forEach(printMessage);
    });

  program
    .command("listen")
    .description("stream messages from the human as they arrive (Ctrl+C to stop)")
    .action(async () => {
      const { client } = connect();
      let cursor = readConfig()?.inbox_cursor ?? 0;
      await client.poll(undefined, async (waitSeconds) => {
        const res = await client.once<MessagesResponse>("GET", `/messages?sender=human&since=${cursor}&wait=${waitSeconds}`);
        cursor = res.cursor;
        saveCursor(cursor);
        res.messages.filter((m) => !m.reply_to).forEach(printMessage);
        return undefined;
      });
    });
}

async function post(body: AgentMessageBody) {
  const { client } = connect();
  const { message } = await client.request<{ message: Message }>("POST", "/messages", { body });
  return message;
}

function parseBlocks(input: unknown): Block[] {
  const blocks = Array.isArray(input) ? input : (input as { blocks?: unknown })?.blocks;
  if (!Array.isArray(blocks)) throw new CliError("--blocks must be a JSON array or an object with a blocks array");
  return blocks;
}

function askBlock(opts: { buttons?: string; form?: string }): Block {
  if (opts.buttons && opts.form) throw new CliError("Use either --buttons or --form, not both");
  if (opts.buttons) {
    const choices = opts.buttons.split(",").map((c) => c.trim()).filter(Boolean);
    return { type: "buttons", id: "choice", options: choices.map((c) => ({ label: c, value: c })) };
  }
  if (opts.form) {
    const input = readJson(opts.form);
    return Array.isArray(input) ? { type: "form", id: "form", fields: input } : { type: "form", id: "form", ...(input as object), fields: (input as { fields: never }).fields };
  }
  return { type: "form", id: FREE_TEXT_ID, fields: [{ type: "textarea", name: FREE_TEXT_ID, label: "Your answer", required: true }] };
}

async function waitForAnswer(messageId: string, timeout: string | undefined) {
  const { client } = connect();
  const reply = await client.poll(deadlineFrom(timeout), async (waitSeconds) => {
    const { replies } = await client.once<{ replies: Message[] }>("GET", `/messages/${messageId}/replies?wait=${waitSeconds}`);
    return replies[0];
  });
  if (!reply) throw new CliError("Timed out waiting for an answer", 2);
  if (json()) return printJson(reply);
  if (reply.enc) throw new CliError("The answer is encrypted, which this CLI version can't read yet");

  const action = "action" in reply.body ? reply.body.action : undefined;
  const value = action?.value as unknown;
  if (action?.element_id === FREE_TEXT_ID && value && typeof value === "object" && FREE_TEXT_ID in value) {
    return console.log((value as Record<string, unknown>)[FREE_TEXT_ID]);
  }
  console.log(typeof value === "string" ? value : JSON.stringify(value ?? reply.body));
}

function printMessage(message: Message) {
  if (json()) return printJson(message);
  const time = new Date(message.created_at).toLocaleString();
  const text = message.enc ? "(encrypted)" : (("text" in message.body && message.body.text) || JSON.stringify(message.body));
  console.log(`[${time}] ${text}`);
}
