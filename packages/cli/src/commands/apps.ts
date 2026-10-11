import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";
import type { Command } from "commander";
import type { Message } from "@rply/schema";
import { appTitle, isApp } from "@rply/schema/helpers";
import { CliError } from "../client.ts";
import { connect, json } from "../context.ts";
import { printJson, readJson } from "../io.ts";
import { commandsDir, listCommands, parseOutput, runScript } from "../scripts.ts";

export function registerApps(program: Command) {
  const app = program.command("app").description("full-page HTML apps listed under the channel, e.g. dashboards and control panels");

  app
    .command("set")
    .description("create or replace the app with this key")
    .argument("<key>", "short name, e.g. dashboard")
    .argument("<file|->", "a single HTML file, or - for stdin")
    .option("--title <title>", "tab title (default: the key)")
    .action(async (key: string, source: string, opts: { title?: string }) => {
      const html = readFileSync(source === "-" ? 0 : source, "utf8");
      const errors = scriptErrors(html);
      if (errors.length) throw new CliError(`The page has script errors, not uploaded:\n${errors.map((e) => `  ${e}`).join("\n")}`);
      const { message } = await connect().client.request<{ message: Message }>("PUT", `/pins/${key}`, {
        body: { title: opts.title, view: "app", blocks: [{ type: "html", id: "app", html }] },
      });
      if (json()) return printJson(message);
      console.log(`App "${key}" ${message.updated_at === null ? "created" : "updated"}`);
    });

  app
    .command("remove")
    .description("delete the app with this key")
    .argument("<key>")
    .action(async (key: string) => {
      await connect().client.request("DELETE", `/pins/${key}`);
      if (!json()) console.log(`Removed app "${key}"`);
    });

  app
    .command("list")
    .description("list apps")
    .action(async () => {
      const { messages } = await connect().client.request<{ messages: Message[] }>("GET", "/pins");
      const apps = messages.filter(isApp);
      if (json()) return printJson(apps);
      if (apps.length === 0) return console.log("No apps.");
      for (const m of apps) console.log(`${m.pin}  ${appTitle(m)}`);
    });

  app
    .command("commands")
    .description("show the folder for command scripts and the commands in it")
    .action(() => {
      const { selected } = connect();
      const dir = commandsDir(selected);
      const names = listCommands(dir);
      if (json()) return printJson({ dir, commands: names });
      console.log(`Command scripts: ${dir}`);
      console.log(names.length ? names.map((n) => `  ${n}`).join("\n") : "  (none yet)");
    });

  app
    .command("call")
    .description("run a command script the way rply serve does, to test it")
    .argument("<name>", "command name")
    .argument("[args]", "arguments as JSON, a file path, or - for stdin")
    .option("--dir <path>", "folder with command scripts (default: see rply app commands)")
    .action(async (name: string, source: string | undefined, opts: { dir?: string }) => {
      const { selected } = connect();
      const dir = opts.dir ? resolve(opts.dir) : commandsDir(selected);
      const args = source === undefined ? null : readJson(source);
      const outcome = await runScript(dir, { id: "test", name, args }, selected.key);
      if ("error" in outcome) throw new CliError(outcome.error);
      console.log(typeof outcome.result === "string" ? outcome.result : JSON.stringify(outcome.result, null, 2));
    });

  program
    .command("respond")
    .description("answer a call from an app (shown by rply inbox)")
    .argument("<call-id>")
    .argument("[value]", "result as JSON, plain text, or - for stdin")
    .option("--error <message>", "report a failure instead")
    .action(async (id: string, value: string | undefined, opts: { error?: string }) => {
      const body = opts.error !== undefined ? { error: opts.error } : { result: parseOutput(value === "-" ? readFileSync(0, "utf8") : (value ?? "")) };
      await connect().client.request("POST", `/calls/${id}/result`, body);
      if (!json()) console.log("Responded");
    });
}

const JS_TYPES = ["", "text/javascript", "application/javascript"];

function scriptErrors(html: string) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].flatMap(([, attrs, code], i) => {
    const type = attrs!.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase() ?? "";
    if (/\bsrc\s*=/i.test(attrs!) || !JS_TYPES.includes(type)) return [];
    try {
      new Script(code!, { filename: `<script> ${i + 1}` });
      return [];
    } catch (err) {
      const where = (err as Error).stack?.split("\n")[0] ?? `<script> ${i + 1}`;
      return [`${where}: ${(err as Error).message}`];
    }
  });
}
