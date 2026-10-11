import { useLayoutEffect, useRef, useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import { embedDocument, type BlockOf } from "@rply/schema";


type Props = { block: BlockOf<"html">; onReply?: (value: unknown) => void; onSend?: (value: unknown, label?: string) => void };

export function HtmlBlock({ block, onReply, onSend }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(block.height ?? 150);
  const scheme = useColorScheme();

  useLayoutEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.rply === "resize" && !block.height) setHeight(Math.min(Math.max(Number(e.data.height) || 0, 40), 2000));
      if (e.data.rply === "reply") onReply?.(e.data.value);
      if (e.data.rply === "send") onSend?.(e.data.value, typeof e.data.label === "string" ? e.data.label : undefined);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [block.height, onReply, onSend]);

  return (
    <View className="gap-1">
      <View className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800">
        <iframe
          ref={frame}
          title={block.label ?? "Embedded content"}
          sandbox="allow-scripts"
          srcDoc={embedDocument(block, "parent", scheme === "dark" ? "dark" : "light")}
          style={{ height, width: "100%", border: 0, display: "block" }}
        />
      </View>
      <Text className="text-xs text-neutral-500">{block.label ?? "Embedded content from the agent"}</Text>
    </View>
  );
}
