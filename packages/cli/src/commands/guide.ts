import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { CliError } from "../client.ts";
import { configPath } from "../config.ts";
import { VERSION } from "../update.ts";

const topics: Record<string, string> = {
  setup: `Setting up this machine. Follow every step; the human is waiting for the result in the rply app.

1. Install the CLI globally, not with npx (the background service needs a stable path):
     npm install --global @rply/cli
2. Connect (skip if \`rply whoami\` already works). If the human gave you a server and an agent code:
     rply join <server-url> <code> --agent-name "<short name for you>"
   Otherwise create the channel yourself and give the human the claim link it prints, so it lands in
   their account (it expires after an hour; \`rply pair\` prints a new one):
     rply init <server-url> --name "<channel name>" --agent-name "<short name for you>"
   One machine can hold several channels (\`rply channels\`). For any channel that isn't the default,
   add --channel <key> to every command below.
3. Learn the rest: \`rply guide all\`. Then add the output of \`rply guide --snippet\` to the instructions
   file your future sessions read (AGENTS.md, CLAUDE.md, ...), so they keep using rply.
4. Decide how the human wakes you. You are probably not running all the time, so rply starts you when
   a message arrives. You need one shell command that runs you headless in your project, for example:
     claude -p "You have new messages in rply. Run rply inbox and handle them."
     codex exec "You have new messages in rply. Run rply inbox and handle them."
   Use your own CLI's non-interactive mode, with permissions that let you do the work unattended.
   Test it once by hand before installing.
5. Install the background service from your project directory:
     cd <your project> && rply serve --install --on-message "<the command from step 4>"
   It restarts on crash and reboot, runs your command once at a time when the human writes (the new
   messages are also on stdin), and runs command scripts for apps. Logs: see the install output.
   Only one agent per channel should use --on-message; others install without it.
   Runs are stopped after an hour. Don't start yourself in the background from the hook (runs would
   overlap); for longer work add --on-message-timeout 4h, or 0 for no limit.
   Never also run \`rply serve\` by hand for the same channel.
6. If you'll build apps, see \`rply guide apps\` and put command scripts in the folder from \`rply app commands\`.
7. Verify: rply send "Setup done. Reply to this message to check I get woken up."
   When you're woken with that reply, answer it. Then setup is complete.

If something can't work here (no service manager, sandbox resets, no headless mode), don't pretend:
tell the human with rply send what works and what doesn't. \`rply listen\` is the fallback for an agent
that runs continuously, and \`rply serve --uninstall\` removes the service.`,

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

Reading messages as data
  rply inbox --json prints one message per line: { id, seq, sender, created_at, reply_to, state, enc, body }
  body is one of
    { text, attachments? }                   a message; attachments: [{ file_id, name, mime, size }]
    { event: { block_id, value, label } }    a click etc. in an embed or app; reply_to is that message
    { call: { name, block_id, args } }       an rply.agent call from an app; answer with rply respond <id>
  enc: true means the body is end-to-end encrypted, which this CLI can't read yet.
  Answers to your questions don't show up here; they come through ask --wait or rply wait.
rply's own notices (updates, hints) go to stderr, never stdout.

Setting up a new machine: rply guide setup
More: rply guide ask | blocks | html | pins | apps | secrets | files | all`,

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

The html can be a fragment or a full document (the outer <!doctype> and <html> tags are dropped).

Inside the embed
  rply.send(value, label)   send an event to your inbox (any number of times), e.g. a clicked bar
  rply.reply(value)         answer the question, only with "question": true and an "id" on the block
  rply.call(name, args)     run a command script on your machine (see rply guide apps)
  rply.agent(name, args)    ask you instead and wait for your rply respond
  rply.storage.get(key) / rply.storage.set(key, value)   small state per human, synced across their devices.
                            localStorage and cookies aren't available in the frame.
  rply.theme                "light" or "dark"
  The frame grows to fit the content. Set "height" to fix it instead.

Styling
  Buttons, inputs, links and tables get default styles that match the app.
  Use these CSS variables so the embed works in light and dark mode:
    --rply-fg  --rply-muted  --rply-border  --rply-surface  --rply-accent
    --rply-bg (the app's background, for sticky headers)  --rply-success  --rply-warning  --rply-danger
  Don't hard-code white or black. The page background is transparent.
  The theme is data-theme="light|dark" on <html>, set by the app, not prefers-color-scheme. It can change
  while the page is open: the window gets a "rply:theme" event, so redraw charts that read colors once.

The frame can run scripts but can't read the app, its storage or the human's session.
http(s) links open in a new tab (on the phone: in the browser), never inside the frame.
Script errors and rejected promises show the human a banner. They can send it to you: it arrives as an
event with value { error }.`,

  pins: `Pinned messages sit at the top of the channel and update in place. Use them for a live overview.

  rply status set '[{"type":"progress","id":"crawl","value":0,"max":120,"label":"Crawl"}]'
  rply status patch '{"id":"crawl","value":42}'
  rply pin set overview "**3 projects** running" --title Overview
  rply pin patch overview --patch '{"id":"pages","value":7}'
  rply pin list | pin remove <key>

"status" is just the conventional key. If the human unpins a message, \`pin patch\` fails and \`pin set\` creates a new one.`,

  apps: `Apps are full-page HTML pages listed under the channel in the app, next to the chat. Use them for dashboards and control panels.

  rply app set dashboard dashboard.html --title "Dashboard"   create or replace (one self-contained HTML file)
  rply app list | app remove <key>
app set refuses pages whose inline scripts don't parse. Styling, theme and storage: rply guide html.

Inside the app, besides rply.send (see rply guide html):
  await rply.call("stats", { range: "7d" })   run a command script on your machine and get its result
  await rply.agent("plan", { pages: 3 })      ask you (the agent) instead, answered with rply respond
  rply.storage.get(key) / rply.storage.set(key, value)   small state per human, synced across their devices, e.g. the selected tab
Both reject with an Error ("offline" when rply serve isn't running, "timeout", or the command's error). Show it in the page.
Fetch data with rply.call when the page loads instead of baking it into the HTML.

Commands are executables you write, one file per command name:
  rply app commands          shows the folder, e.g. ~/.config/rply/commands/<channel>/
  rply serve --install       runs them when the app calls, as a background service (see rply guide setup)
A command gets the args as JSON on stdin (env RPLY_CHANNEL, RPLY_CALL_NAME, RPLY_CALL_ID) and prints its result
to stdout (JSON, or plain text). A non-zero exit fails the call with the last line of stderr.
Limits: 30s and 4 MB of output per call. rply.agent results are stored as messages, so keep them under 256 KB.
Example, saved as <folder>/stats and made executable (chmod +x):
  #!/bin/sh
  printf '{"disk":"%s"}' "$(df -h / | awk 'NR==2{print $5}')"
Treat args as untrusted input: validate them and never pass them to a shell unchecked.
Test a command exactly as serve runs it: rply app call stats '{"range":"7d"}'

rply.agent calls show up in \`rply inbox\` and in the chat:
  call "plan" from app in message <id>: {...}
Answer with \`rply respond <call-id> '<json>'\` (or --error "..."). The page waits while it's open.
Use rply.agent for work that needs you, never for polling: every call is a message.`,

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

const order = ["setup", "basics", "ask", "blocks", "html", "pins", "apps", "secrets", "files"];

const snippet = `## Talking to the human (rply)

This agent reports to its human through the \`rply\` CLI. Run \`rply guide\` once per session before using it.
- Send progress with \`rply send\`, keep \`rply status\` up to date, and check \`rply inbox\` for new instructions.
- Ask with \`rply ask ... --wait\` when a decision is the human's.
- Request credentials with \`rply secret request\`, never through messages.
- When you were started because of new rply messages, run \`rply inbox\` first and answer through rply.`;

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
      const names = topic === "all" ? order.filter((t) => t !== "setup") : [topic ?? "basics"];
      console.log(names.map((name) => topics[name]).join("\n\n"));
      markSeen();
    });
}
