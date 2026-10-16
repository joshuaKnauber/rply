import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { CliError } from "./client.ts";
import { configPath } from "./config.ts";

export type Service = { key: string; args: string[]; cwd: string };

export const logPath = (key: string) => join(dirname(configPath()), "logs", `${key}.log`);

const unitName = (key: string) => `rply-${key}`;
const unitPath = (key: string) => join(homedir(), ".config", "systemd", "user", `${unitName(key)}.service`);
const label = (key: string) => `sh.rply.${key}`;
const plistPath = (key: string) => join(homedir(), "Library", "LaunchAgents", `${label(key)}.plist`);
const domain = () => `gui/${userInfo().uid}`;

// Non-login shells (e.g. plain ssh) often lack XDG_RUNTIME_DIR, which systemctl --user needs to reach the user bus
const userRuntimeDir = `/run/user/${userInfo().uid}`;
const runEnv = !process.env.XDG_RUNTIME_DIR && existsSync(userRuntimeDir) ? { ...process.env, XDG_RUNTIME_DIR: userRuntimeDir } : process.env;

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: "utf8", env: runEnv });

export function installService({ key, args, cwd }: Service) {
  if (!/^[a-z0-9_-]+$/i.test(key)) throw new CliError(`Channel key "${key}" can't be used as a service name`);
  if (/[\\/]_npx[\\/]/.test(process.argv[1] ?? "")) {
    throw new CliError("rply is running from npx, which disappears later. Install it first: npm install --global @rply/cli");
  }
  const program = [process.execPath, process.argv[1]!, "--channel", key, "serve", ...args];
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", RPLY_SERVICE: "1", ...(process.env.RPLY_CONFIG && { RPLY_CONFIG: process.env.RPLY_CONFIG }) };
  mkdirSync(dirname(logPath(key)), { recursive: true });

  if (process.platform === "linux") return installSystemd(key, program, env, cwd);
  if (process.platform === "darwin") return installLaunchd(key, program, env, cwd);
  throw new CliError(`Installing a service isn't supported on ${process.platform}. Keep \`rply serve\` running with your own process manager.`);
}

export function uninstallService(key: string) {
  if (process.platform === "linux") {
    run("systemctl", ["--user", "disable", "--now", unitName(key)]);
    rmSync(unitPath(key), { force: true });
    run("systemctl", ["--user", "daemon-reload"]);
  } else if (process.platform === "darwin") {
    run("launchctl", ["bootout", `${domain()}/${label(key)}`]);
    rmSync(plistPath(key), { force: true });
  }
}

export function serviceRunning(key: string) {
  if (process.platform === "linux") return existsSync(unitPath(key)) && run("systemctl", ["--user", "is-active", "--quiet", unitName(key)]).status === 0;
  if (process.platform === "darwin") return existsSync(plistPath(key)) && run("launchctl", ["print", `${domain()}/${label(key)}`]).status === 0;
  return false;
}

const systemdQuote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%%").replace(/\$/g, "$$$$")}"`;

function installSystemd(key: string, program: string[], env: Record<string, string>, cwd: string) {
  const unit = `[Unit]
Description=rply serve (${key})
After=network-online.target

[Service]
WorkingDirectory=${cwd}
${Object.entries(env)
  .map(([k, v]) => `Environment=${systemdQuote(`${k}=${v}`)}`)
  .join("\n")}
ExecStart=${program.map(systemdQuote).join(" ")}
Restart=always
RestartSec=5
StandardOutput=append:${logPath(key)}
StandardError=append:${logPath(key)}

[Install]
WantedBy=default.target
`;
  mkdirSync(dirname(unitPath(key)), { recursive: true });
  writeFileSync(unitPath(key), unit);
  const reload = run("systemctl", ["--user", "daemon-reload"]);
  if (reload.status !== 0) throw new CliError(`systemctl --user isn't available: ${reload.stderr.trim()}. Keep \`rply serve\` running another way.`);
  const enable = run("systemctl", ["--user", "enable", "--now", unitName(key)]);
  if (enable.status !== 0) throw new CliError(`Couldn't start ${unitName(key)}: ${enable.stderr.trim()}`);
  run("systemctl", ["--user", "restart", unitName(key)]);
  const linger = run("loginctl", ["enable-linger", userInfo().username]);
  return {
    name: unitName(key),
    file: unitPath(key),
    warning: linger.status === 0 ? undefined : `Couldn't enable linger, so the service may stop when you log out. Ask an admin to run: loginctl enable-linger ${userInfo().username}`,
  };
}

const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function installLaunchd(key: string, program: string[], env: Record<string, string>, cwd: string) {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label(key)}</string>
  <key>ProgramArguments</key>
  <array>
${program.map((arg) => `    <string>${xml(arg)}</string>`).join("\n")}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(env)
  .map(([k, v]) => `    <key>${xml(k)}</key><string>${xml(v)}</string>`)
  .join("\n")}
  </dict>
  <key>WorkingDirectory</key><string>${xml(cwd)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${xml(logPath(key))}</string>
  <key>StandardErrorPath</key><string>${xml(logPath(key))}</string>
</dict>
</plist>
`;
  mkdirSync(dirname(plistPath(key)), { recursive: true });
  run("launchctl", ["bootout", `${domain()}/${label(key)}`]);
  writeFileSync(plistPath(key), plist);
  const boot = run("launchctl", ["bootstrap", domain(), plistPath(key)]);
  if (boot.status !== 0) throw new CliError(`Couldn't start ${label(key)}: ${boot.stderr.trim()}`);
  return { name: label(key), file: plistPath(key), warning: undefined };
}
