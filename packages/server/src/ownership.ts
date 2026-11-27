import { HTTPException } from "hono/http-exception";
import type { Auth } from "./context.ts";

export type Caller = Pick<Auth, "agentId" | "userId">;

// a row that a request addresses by id: agent-owned rows name the agent (with its label for the refusal), user-owned rows the user
export type OwnedRow = { agent_id: string | null; agent_label?: string | null; agent_revoked_at?: number | null } | { user_id: string | null };

// the one ownership policy for rows addressed by id; rows without an agent (old messages, the human's own rows) stay free
export function assertOwnRow(row: OwnedRow, caller: Caller, what = "This message", hint = "Agents can only change their own messages and pins.") {
  if ("user_id" in row) {
    if (row.user_id === null || row.user_id === caller.userId) return;
    throw new HTTPException(403, { message: `${what} belongs to another user. ${hint}` });
  }
  if (!row.agent_id || row.agent_id === caller.agentId || (row.agent_revoked_at ?? null) !== null) return;
  throw new HTTPException(403, { message: `${what} belongs to ${row.agent_label ?? "another agent"}. ${hint}` });
}
