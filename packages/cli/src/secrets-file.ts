import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const quote = (value: string) =>
  /^[A-Za-z0-9_\-.\/:@+=,]*$/.test(value) ? value : `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/\n/g, "\\n")}"`;

function writePrivate(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.rply-${process.pid}.tmp`;
  writeFileSync(tmp, content, { mode: 0o600 });
  renameSync(tmp, path);
  chmodSync(path, 0o600);
}

export function writeEnvValue(path: string, name: string, value: string) {
  const line = `${name}=${quote(value)}`;
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  if (lines.at(-1) === "") lines.pop();
  const pattern = new RegExp(`^\\s*(export\\s+)?${name}\\s*=`);
  const index = lines.findIndex((l) => pattern.test(l));
  if (index >= 0) lines[index] = line;
  else lines.push(line);
  writePrivate(path, lines.join("\n") + "\n");
}

export const writeSecretFile = (path: string, value: string) => writePrivate(path, value);
