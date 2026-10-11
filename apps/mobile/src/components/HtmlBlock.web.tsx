import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import { embedDocument, type BlockOf } from "@rply/schema";
import { useEmbedBridge } from "@/lib/embed";
import { EmbedError } from "./EmbedError";

type Props = { block: BlockOf<"html">; fill?: boolean; onReply?: (value: unknown) => void; onSend?: (value: unknown, label?: string) => void };

export function HtmlBlock({ block, fill, onReply, onSend }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(block.height ?? 150);
  const scheme = useColorScheme();
  const bridge = useEmbedBridge(block, (data) => frame.current?.contentWindow?.postMessage(data, "*"));
  const srcDoc = useMemo(
    () => embedDocument(block, "parent", scheme === "dark" ? "dark" : "light", { storage: bridge.loadStorage(), fill }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [block.html, block.height, scheme, fill],
  );

  useLayoutEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.rply === "resize" && !block.height && !fill) setHeight(Math.min(Math.max(Number(e.data.height) || 0, 40), 2000));
      if (e.data.rply === "reply") onReply?.(e.data.value);
      if (e.data.rply === "send") onSend?.(e.data.value, typeof e.data.label === "string" ? e.data.label : undefined);
      bridge.handle(e.data);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [block.height, fill, onReply, onSend, bridge]);

  const iframe = (
    <iframe
      ref={frame}
      title={block.label ?? "Embedded content"}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      style={{ height: fill ? "100%" : height, width: "100%", border: 0, display: "block" }}
    />
  );

  const banner = bridge.error && (
    <EmbedError
      message={bridge.error}
      onSend={onSend && (() => (onSend({ error: bridge.error }, `App error: ${bridge.error!.slice(0, 120)}`), bridge.clearError()))}
      onDismiss={bridge.clearError}
    />
  );

  if (fill) {
    return (
      <View className="flex-1">
        {banner}
        <View className="flex-1">{iframe}</View>
      </View>
    );
  }

  return (
    <View className="gap-1">
      {banner}
      <View className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800">{iframe}</View>
      <Text className="text-xs text-neutral-500">{block.label ?? "Embedded content from the agent"}</Text>
    </View>
  );
}
