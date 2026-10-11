import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { embedDocument, type BlockOf, type EmbedTheme } from "@rply/schema";
import { callCommand, loadAppStorage, saveAppStorage } from "@/lib/apps";
import { useChannelEntry, useMessage } from "@/lib/channel-context";

type Props = { block: BlockOf<"html">; fill?: boolean; onReply?: (value: unknown) => void; onSend?: (value: unknown, label?: string) => void };

const currentTheme = (): EmbedTheme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

export function HtmlBlock({ block, fill, onReply, onSend }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(block.height ?? 150);
  const theme: EmbedTheme = useTheme().resolvedTheme === "dark" ? "dark" : "light";
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

  const srcDoc = useMemo(() => {
    storage.current = channelId && storageKey ? loadAppStorage(channelId, storageKey) : {};
    return embedDocument(block, "parent", currentTheme(), { storage: storage.current, fill });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.html, block.height, fill, channelId, storageKey]);

  useLayoutEffect(() => {
    const post = (data: unknown) => frame.current?.contentWindow?.postMessage(data, "*");
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      const data = e.data;
      if (data.rply === "resize" && !block.height && !fill) setHeight(Math.min(Math.max(Number(data.height) || 0, 40), 2000));
      if (data.rply === "reply") onReply?.(data.value);
      if (data.rply === "send") onSend?.(data.value, typeof data.label === "string" ? data.label : undefined);
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
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [block.height, block.id, fill, onReply, onSend, entry, message, channelId, storageKey]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ rply: "theme", theme }, "*");
  }, [theme]);

  useEffect(() => setError(null), [srcDoc]);

  const banner = error && (
    <ErrorBanner
      message={error}
      onSend={onSend && (() => (onSend({ error }, `App error: ${error.slice(0, 120)}`), setError(null)))}
      onDismiss={() => setError(null)}
    />
  );

  const iframe = (
    <iframe
      ref={frame}
      title={block.label ?? "Embedded content"}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      style={fill ? { colorScheme: theme } : { height, colorScheme: theme }}
      className={fill ? "block size-full border-0 bg-transparent" : "block w-full border-0 bg-transparent"}
    />
  );

  if (fill) {
    return (
      <div className="flex size-full flex-col">
        {banner}
        <div className="min-h-0 flex-1">{iframe}</div>
      </div>
    );
  }

  return (
    <div className="bg-background overflow-hidden rounded-lg border dark:bg-input/20">
      {block.label && <div className="text-muted-foreground border-b px-3 py-2 text-sm">{block.label}</div>}
      {banner}
      <div className="p-3">{iframe}</div>
    </div>
  );
}

function ErrorBanner({ message, onSend, onDismiss }: { message: string; onSend?: () => void; onDismiss: () => void }) {
  return (
    <div className="bg-destructive/10 text-destructive flex items-center gap-2 border-b px-3 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate" title={message}>
        This app hit an error: {message}
      </span>
      {onSend && (
        <Button size="xs" variant="ghost" className="text-destructive shrink-0" onClick={onSend}>
          Send to agent
        </Button>
      )}
      <Button size="icon-xs" variant="ghost" className="text-destructive -mr-1 shrink-0" onClick={onDismiss} aria-label="Dismiss">
        <XIcon />
      </Button>
    </div>
  );
}
