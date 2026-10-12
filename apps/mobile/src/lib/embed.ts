import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BlockOf } from "@rply/schema";
import { callCommand, saveAppStorage, useAppStorage } from "./apps";
import { useChannelEntry, useMessage } from "./channel-context";

type Incoming = { rply?: string; id?: unknown; name?: unknown; args?: unknown; agent?: unknown; key?: unknown; value?: unknown; message?: unknown };

export function useEmbedBridge(block: BlockOf<"html">, post: (data: unknown) => void) {
  const entry = useChannelEntry();
  const message = useMessage();
  const queryClient = useQueryClient();
  const { data: stored, isPending } = useAppStorage(entry);
  const storageKey = message?.pin ?? message?.id;
  const storage = useRef<Record<string, unknown>>({});
  const unmounted = useRef(new AbortController());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    unmounted.current = controller;
    return () => controller.abort();
  }, []);

  const loadStorage = () => {
    const value = storageKey ? stored?.[storageKey] : undefined;
    return (storage.current = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {});
  };

  useEffect(() => setError(null), [block.html]);

  const handle = (data: Incoming) => {
    if (data.rply === "error") setError(String(data.message).slice(0, 500));
    if (data.rply === "storage" && entry && storageKey && typeof data.key === "string") {
      if (data.value === undefined) delete storage.current[data.key];
      else storage.current[data.key] = data.value;
      saveAppStorage(queryClient, entry, storageKey, storage.current);
    }
    if (data.rply === "call") {
      if (!entry || !message) return post({ rply: "result", id: data.id, error: "Calls aren't available here" });
      const req = { message_id: message.id, block_id: block.id ?? null, name: String(data.name), args: data.args ?? null, agent: data.agent === true };
      callCommand(entry, req, unmounted.current.signal).then(
        (result) => post({ rply: "result", id: data.id, result }),
        (err: Error) => post({ rply: "result", id: data.id, error: err.message }),
      );
    }
  };

  return { ready: !entry || !isPending, loadStorage, handle, error, clearError: () => setError(null) };
}
