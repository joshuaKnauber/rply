import { useEffect, useRef, useState } from "react";
import type { BlockOf } from "@rply/schema";
import { callCommand, loadAppStorage, saveAppStorage } from "./apps";
import { useChannelEntry, useMessage } from "./channel-context";

type Incoming = { rply?: string; id?: unknown; name?: unknown; args?: unknown; agent?: unknown; key?: unknown; value?: unknown; message?: unknown };

export function useEmbedBridge(block: BlockOf<"html">, post: (data: unknown) => void) {
  const entry = useChannelEntry();
  const message = useMessage();
  const channelId = entry?.channel.id;
  const storageKey = message?.pin ?? message?.id;
  const storage = useRef<Record<string, unknown>>({});
  const unmounted = useRef(new AbortController());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    unmounted.current = controller;
    return () => controller.abort();
  }, []);

  const loadStorage = () => (storage.current = channelId && storageKey ? loadAppStorage(channelId, storageKey) : {});

  useEffect(() => setError(null), [block.html]);

  const handle = (data: Incoming) => {
    if (data.rply === "error") setError(String(data.message).slice(0, 500));
    if (data.rply === "storage" && channelId && storageKey && typeof data.key === "string") {
      if (data.value === undefined) delete storage.current[data.key];
      else storage.current[data.key] = data.value;
      saveAppStorage(channelId, storageKey, storage.current);
    }
    if (data.rply === "call") {
      if (!entry || entry.revoked || !message) return post({ rply: "result", id: data.id, error: "Calls aren't available here" });
      const req = { message_id: message.id, block_id: block.id ?? null, name: String(data.name), args: data.args ?? null, agent: data.agent === true };
      callCommand(entry, req, unmounted.current.signal).then(
        (result) => post({ rply: "result", id: data.id, result }),
        (err: Error) => post({ rply: "result", id: data.id, error: err.message }),
      );
    }
  };

  return { loadStorage, handle, error, clearError: () => setError(null) };
}
