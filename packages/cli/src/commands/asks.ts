import type { Command } from "commander";
import { inputDefaults, inputsOf, isInput, messageBlocks, type AskResponse, type Block, type Message } from "@rply/schema";
import { CliError } from "../client.ts";
import { connect, json } from "../context.ts";
import { deadlineFrom, parseDuration, printJson, readJson } from "../io.ts";
import { parseBlocks, post } from "./messages.ts";

const ANSWER_ID = "answer";

type AskOptions = {
  title?: string;
  choices?: string;
  buttons?: string;
  multi?: boolean;
  other?: boolean;
  confirm?: string;
  danger?: boolean;
  form?: string;
  blocks?: string;
  default?: string;
  expires?: string;
  wait?: boolean;
  timeout?: string;
};

export function registerAsks(program: Command) {
  program
    .command("ask")
    .allowUnknownOption()
    .description("ask the human something; without --choices, --confirm or input blocks they get a text field")
    .argument("<question>", "the question, markdown supported")
    .option("--title <title>", "bold title above the question")
    .option("--choices <list>", 'comma-separated choices, e.g. "Publish,Skip"')
    .option("--buttons <list>", "same as --choices")
    .option("--multi", "allow picking several choices")
    .option("--other", "allow a typed answer besides the choices")
    .option("--confirm <label>", 'a single confirm button, e.g. "Delete 40 pages"')
    .option("--danger", "style the choices or the confirm button as dangerous")
    .option("--form <json|file|->", "form fields as a JSON array, asked together")
    .option("--blocks <json|file|->", "blocks to include; several input blocks ask several questions at once")
    .option("--default <value>", "answer to use if the question expires (comma-separated with --multi)")
    .option("--expires <duration>", "stop accepting answers after e.g. 2h (defaults to --timeout when waiting)")
    .option("--wait", "block until answered and print the answer")
    .option("--timeout <duration>", "give up waiting after e.g. 30m (exit code 2)")
    .addHelpText(
      "after",
      `
Output with --wait: a single question prints its answer (strings as-is, other values as JSON).
Several questions print a JSON object keyed by block id. --json prints { status, answers, message_id }.
Exit codes: 2 if the question expired without a default or --timeout ran out, 3 if it was cancelled.`,
    )
    .action(async (question: string, opts: AskOptions) => {
      const blocks = [...(opts.blocks ? parseBlocks(readJson(opts.blocks)) : []), ...questionBlocks(opts)];
      if (!blocks.some(isInput)) blocks.push(withDefault({ type: "text_input", id: ANSWER_ID, multiline: true, required: true }, opts));
      const expires = parseDuration(opts.expires ?? (opts.wait ? opts.timeout : undefined));
      const message = await post({ title: opts.title, text: question, blocks }, { ask: { expires_at: expires === undefined ? undefined : Date.now() + expires } });

      if (!opts.wait) {
        if (json()) return printJson(message);
        return console.log(`Asked (id: ${message.id}). Get the answer with: rply wait ${message.id}`);
      }
      await waitForAnswer(message.id, opts.timeout);
    });

  program
    .command("wait")
    .description("wait for the answer to an earlier question")
    .argument("<message-id>", "id printed by rply ask")
    .option("--timeout <duration>", "give up after e.g. 30m (exit code 2)")
    .action((id: string, opts: { timeout?: string }) => waitForAnswer(id, opts.timeout));

  program
    .command("asks")
    .description("list your questions that are still waiting for an answer")
    .action(async () => {
      const { messages } = await connect().client.request<{ messages: Message[] }>("GET", "/asks");
      if (json()) return printJson(messages);
      if (messages.length === 0) return console.log("No open questions.");
      for (const m of messages) {
        const text = m.enc ? "(encrypted)" : ("text" in m.body && m.body.text) || "(question)";
        const expires = m.ask?.expires_at ? `, expires ${new Date(m.ask.expires_at).toLocaleString()}` : "";
        console.log(`${m.id}  ${text}${expires}`);
      }
    });

  program
    .command("cancel")
    .description("withdraw a question that hasn't been answered")
    .argument("<message-id>")
    .action(async (id: string) => {
      const { message } = await connect().client.request<{ message: Message }>("POST", `/messages/${id}/cancel`);
      if (json()) return printJson(message);
      console.log("Question cancelled");
    });
}

function questionBlocks(opts: AskOptions): Block[] {
  const choices = opts.choices ?? opts.buttons;
  const given = [choices, opts.confirm, opts.form].filter((x) => x !== undefined).length;
  if (given > 1) throw new CliError("Use only one of --choices, --confirm or --form");

  if (choices) {
    const options = choices.split(",").map((c) => c.trim()).filter(Boolean).map((label) => ({ label, danger: opts.danger || undefined }));
    return [withDefault({ type: "choice", id: ANSWER_ID, options, multi: opts.multi, other: opts.other }, opts)];
  }
  if (opts.confirm) return [{ type: "confirm", id: ANSWER_ID, label: opts.confirm, danger: opts.danger }];
  if (opts.form) {
    const input = readJson(opts.form);
    const fields = Array.isArray(input) ? input : (input as { fields?: unknown[] }).fields;
    if (!Array.isArray(fields)) throw new CliError("--form must be a JSON array of fields");
    return fields.map(fieldToBlock);
  }
  return [];
}

function withDefault<T extends Block>(block: T, opts: AskOptions): T {
  if (opts.default === undefined) return block;
  const value = block.type === "choice" && opts.multi ? opts.default.split(",").map((v) => v.trim()) : opts.default;
  return { ...block, default: value };
}

function fieldToBlock(field: Record<string, unknown>): Block {
  const base = { id: String(field.name ?? field.id), label: field.label as string | undefined, required: field.required as boolean | undefined };
  switch (field.type) {
    case "textarea":
      return { type: "text_input", ...base, multiline: true, placeholder: field.placeholder as string | undefined };
    case "number":
      return { type: "number_input", ...base };
    case "select":
      return { type: "choice", ...base, options: (field.options as string[]).map((label) => ({ label })) };
    case "toggle":
      return { type: "toggle", id: base.id, label: base.label ?? base.id };
    default:
      return { type: "text_input", ...base, placeholder: field.placeholder as string | undefined };
  }
}

async function waitForAnswer(id: string, timeout: string | undefined) {
  const { client } = connect();
  const res = await client.poll(deadlineFrom(timeout), async (waitSeconds) => {
    const r = await client.once<AskResponse>("GET", `/asks/${id}?wait=${waitSeconds}`);
    return r.message.ask?.status === "open" ? undefined : r;
  });
  if (!res) throw new CliError("Timed out waiting for an answer", 2);

  const { message, answer } = res;
  if (message.enc || answer?.enc) throw new CliError("This question is encrypted, which this CLI version can't read yet");
  const inputs = inputsOf(messageBlocks(message));
  const status = message.ask!.status;

  let answers: Record<string, unknown> | undefined;
  if (status === "answered") answers = answer && "answers" in answer.body ? answer.body.answers : {};
  if (status === "expired") {
    const defaults = inputDefaults(inputs);
    answers = Object.keys(defaults).length ? defaults : undefined;
  }

  if (json()) printJson({ status, answers: answers ?? null, message_id: message.id });
  if (status === "cancelled") throw new CliError("The question was cancelled", 3);
  if (!answers) throw new CliError("The question expired without an answer", 2);
  if (status === "expired") console.error("rply: the question expired, using the default answer");
  if (json()) return;

  const value = inputs.length === 1 ? answers[inputs[0]!.id!] : answers;
  console.log(typeof value === "string" ? value : JSON.stringify(value));
}
