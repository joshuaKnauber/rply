import { accessSync, constants, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import type { Message } from "@rply/schema";
import { appTitle, COMMAND_NAME, isApp } from "@rply/schema/helpers";
import { configPath, type Selected } from "../config.ts";
import { connect, json } from "../context.ts";
import { printJson } from "../io.ts";

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
      const { message } = await connect().client.request<{ message: Message }>("PUT", `/pins/${key}`, {
        body: { title: opts.title, view: "app", blocks: [{ type: "html", id: "app", html }] },
      });
      if (json()) return printJson(message);
      console.log(`App "${key}" updated`);
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

export const commandsDir = (selected: Selected) => join(dirname(configPath()), "commands", selected.key ?? "default");

export function listCommands(dir: string) {
  try {
    return readdirSync(dir).filter((name) => COMMAND_NAME.test(name) && isExecutable(join(dir, name)));
  } catch {
    return [];
  }
}

export function isExecutable(path: string) {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function parseOutput(output: string) {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
