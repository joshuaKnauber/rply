import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { CliError } from "../client.ts";
import { configPath } from "../config.ts";
import { VERSION } from "../update.ts";

const topics: Record<string, string> = {
  basics: `rply connects you to the human you work for. They read and answer in the rply app (web and phone, with push notifications).

Talking
  rply send "Deployed 3 pages"               message, markdown supported
  rply send "Done" --title "Deploy" --silent  --silent: no push notification
  rply ask "Publish?" --choices yes,no --wait prints the answer
  rply inbox                                  new messages from the human (marks them seen)
  rply listen                                 stream them as JSONL, for long-running agents
  rply ack <message-id> working|done          show the human you picked a message up

Good habits
- Check \`rply inbox\` regularly. The human can message you at any time with new instructions.
- Ask instead of guessing when a decision is theirs. Use --wait if you can't continue without it.
- Keep a live overview with \`rply status set\` instead of sending a message for every step.
- Never send secrets through messages. Use \`rply secret request\`.
- Keep messages short. The human reads them on a phone.

More: rply guide ask | blocks | html | pins | secrets | files | all`,

  ask: `Questions
  rply ask "Publish these 5 pages?" --choices Publish,Skip --wait
  rply ask "Delete 40 pages?" --confirm "Delete" --danger --wait
  rply ask "Which tone?" --choices formal,casual --other --default casual --expires 2h --wait
  rply ask "Anything to add?" --wait          no choices: the human gets a text field
  rply ask "New page" --blocks form.json --wait   several inputs, answered together

--wait prints one answer as plain text, or a JSON object keyed by block id for several inputs.
Without --wait the command prints a message id. Get the answer later with \`rply wait <id>\`.
\`rply asks\` lists open questions, \`rply cancel <id>\` withdraws one.
Exit codes: 2 = expired without a default or --timeout ran out, 3 = cancelled.`,

  blocks: `Blocks are a JSON array passed with --blocks (inline JSON, a file path, or - for stdin).

Display
  {"type":"markdown","text":"**Bold** and lists"}
  {"type":"heading","text":"Results"}
  {"type":"code","code":"npm run build","language":"sh"}
  {"type":"link","url":"https://example.com","label":"Open report"}
  {"type":"progress","id":"pages","value":42,"max":120,"label":"Pages crawled"}
  {"type":"keyvalue","items":[{"key":"Pages","value":"318"}]}
  {"type":"table","columns":["Keyword","Rank"],"rows":[["agent inbox",4]]}
  {"type":"image","file_id":"..."} and {"type":"file","file_id":"...","name":"data.csv"}  (see rply guide files)
  {"type":"html","html":"..."}  (see rply guide html)

Inputs (need an "id"; a message with inputs is a question)
  {"type":"choice","id":"tone","label":"Tone","options":[{"label":"Formal"},{"label":"Casual","description":"Default"}],"multi":false,"other":false,"default":"Casual"}
  {"type":"text_input","id":"title","label":"Title","placeholder":"...","multiline":false,"required":true}
  {"type":"number_input","id":"count","label":"How many?","min":1,"max":50}
  {"type":"toggle","id":"notify","label":"Email subscribers"}
  {"type":"confirm","id":"go","label":"Deploy now","description":"Takes 2 minutes","danger":false}

Update a block later by its id: rply edit <message-id> --patch '{"id":"pages","value":43}'`,

  html: `HTML embeds run your HTML in a sandboxed frame inside the message. Use them for charts and custom UI.

  rply send "Traffic this week" --blocks '[{"type":"html","label":"Traffic","html":"<div>...</div>"}]'

Inside the embed
  rply.send(value, label)   send an event to your inbox (any number of times), e.g. a clicked bar
  rply.reply(value)         answer the question, only with "question": true and an "id" on the block
  The frame grows to fit the content. Set "height" to fix it instead.

Styling
  Buttons, inputs, links and tables get default styles that match the app.
  Use these CSS variables so the embed works in light and dark mode:
    var(--rply-fg)  var(--rply-muted)  var(--rply-border)  var(--rply-surface)  var(--rply-accent)
  Don't hard-code white or black backgrounds. The background is transparent.

The frame can run scripts but can't read the app, its storage or the human's tokens. Links don't navigate the app.`,

  pins: `Pinned messages sit at the top of the channel and update in place. Use them for a live overview.

  rply status set '[{"type":"progress","id":"crawl","value":0,"max":120,"label":"Crawl"}]'
  rply status patch '{"id":"crawl","value":42}'
  rply pin set overview "**3 projects** running" --title Overview
  rply pin patch overview --patch '{"id":"pages","value":7}'
  rply pin list | pin remove <key>

"status" is just the conventional key. If the human unpins a message, \`pin patch\` fails and \`pin set\` creates a new one.`,

  secrets: `Ask the human for credentials without ever seeing them. The value is encrypted on their device and written straight to a file.

  rply secret request OPENAI_API_KEY --to .env --reason "Keyword research" --wait
  rply secret request SERVICE_ACCOUNT --to key.json --file --wait

Prints only "NAME written to /abs/path". Never cat the file into a message or log.
Without --wait: \`rply secret fetch <id> --wait\` later. \`rply secret cancel <id>\` withdraws it.
Exit codes: 2 = expired or timed out, 3 = declined or cancelled.`,

  files: `Attachments
  rply send "Weekly report" --image chart.png --file keywords.csv   repeatable, also on pin set
  rply file upload chart.png                                       prints a file id for image/file blocks
  rply file get <file-id> [--to path]                              download a file the human sent

\`rply inbox\` lists files the human attached, with the \`rply file get\` command for each.`,
};

const order = ["basics", "ask", "blocks", "html", "pins", "secrets", "files"];

const snippet = `## Talking to the human (rply)

This agent reports to its human through the \`rply\` CLI. Run \`rply guide\` once per session before using it.
- Send progress with \`rply send\`, keep \`rply status\` up to date, and check \`rply inbox\` for new instructions.
- Ask with \`rply ask ... --wait\` when a decision is the human's.
- Request credentials with \`rply secret request\`, never through messages.`;

const seenPath = () => join(dirname(configPath()), "guide.json");

export function guideHint() {
  if (process.argv[2] === "guide" || process.env.RPLY_NO_GUIDE_HINT) return undefined;
  try {
    if (existsSync(seenPath()) && JSON.parse(readFileSync(seenPath(), "utf8")).seen === VERSION) return undefined;
  } catch {}
  return "rply: run `rply guide` to learn how to talk to the human (shown until you've read it for this version).";
}

function markSeen() {
  try {
    mkdirSync(dirname(seenPath()), { recursive: true });
    writeFileSync(seenPath(), JSON.stringify({ seen: VERSION }));
  } catch {}
}

export function registerGuide(program: Command) {
  program
    .command("guide")
    .description("how to use rply as an agent: start here")
    .argument("[topic]", `one of ${order.join(", ")}, or all`)
    .option("--snippet", "print lines to add to AGENTS.md or CLAUDE.md")
    .action((topic: string | undefined, opts: { snippet?: boolean }) => {
      if (opts.snippet) return console.log(snippet);
      if (topic && topic !== "all" && !topics[topic]) throw new CliError(`Unknown topic "${topic}". Topics: ${order.join(", ")}, all`);
      const names = topic === "all" ? order : [topic ?? "basics"];
      console.log(names.map((name) => topics[name]).join("\n\n"));
      markSeen();
    });
}
