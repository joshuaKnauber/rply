import type { PendingCall } from "@rply/schema";

const ONLINE_GRACE = 15_000;

export type Serve = { channelId: string; commands: Set<string>; wakes: boolean; polling: number; seen: number; queue: PendingCall[] };

export type Serves = ReturnType<typeof createServes>;

export function createServes() {
  const byAgent = new Map<string, Serve>();
  const online = (s: Serve) => s.polling > 0 || Date.now() - s.seen < ONLINE_GRACE;

  return {
    register(agentId: string, channelId: string) {
      const serve = byAgent.get(agentId) ?? { channelId, commands: new Set(), wakes: false, polling: 0, seen: 0, queue: [] };
      byAgent.set(agentId, serve);
      return serve;
    },
    online: (agentId: string) => {
      const serve = byAgent.get(agentId);
      return serve && online(serve) ? serve : undefined;
    },
    onlineIn: (channelId: string) => [...byAgent].filter(([, s]) => s.channelId === channelId && online(s)),
  };
}
