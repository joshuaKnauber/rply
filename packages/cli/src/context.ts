import { createClient } from "./client.ts";
import { loadConfig } from "./config.ts";

let jsonMode = false;
export const setJsonMode = (value: boolean) => (jsonMode = value);
export const json = () => jsonMode;

export function connect() {
  const config = loadConfig();
  return { config, client: createClient(config.server, config.token) };
}
