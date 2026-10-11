import { useMemo, useRef, useState } from "react";
import { Linking, Text, useColorScheme, View } from "react-native";
import { WebView } from "react-native-webview";
import { embedDocument, type BlockOf } from "@rply/schema";
import { useEmbedBridge } from "@/lib/embed";

type Props = { block: BlockOf<"html">; fill?: boolean; onReply?: (value: unknown) => void; onSend?: (value: unknown, label?: string) => void };

export function HtmlBlock({ block, fill, onReply, onSend }: Props) {
  const webview = useRef<WebView>(null);
  const [height, setHeight] = useState(block.height ?? 150);
  const scheme = useColorScheme();
  const bridge = useEmbedBridge(block, (data) => webview.current?.injectJavaScript(`__rplyReceive(${JSON.stringify(data)});true;`));
  const html = useMemo(
    () => embedDocument(block, "native", scheme === "dark" ? "dark" : "light", { storage: bridge.loadStorage(), fill }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [block.html, block.height, scheme, fill],
  );

  const view = (
    <WebView
      ref={webview}
      originWhitelist={["*"]}
      source={{ html }}
      scrollEnabled={Boolean(fill)}
      setSupportMultipleWindows={false}
      style={{ backgroundColor: "transparent" }}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url === "about:blank" || req.url.startsWith("data:")) return true;
        if (/^https?:\/\//.test(req.url)) Linking.openURL(req.url);
        return false;
      }}
      onMessage={(e) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          if (data.rply === "resize" && !block.height && !fill) setHeight(Math.min(Math.max(Number(data.height) || 0, 40), 2000));
          if (data.rply === "reply") onReply?.(data.value);
          if (data.rply === "send") onSend?.(data.value, typeof data.label === "string" ? data.label : undefined);
          bridge.handle(data);
        } catch {}
      }}
    />
  );

  if (fill) return <View className="flex-1">{view}</View>;

  return (
    <View className="gap-1">
      <View style={{ height: height + 2 }} className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        {view}
      </View>
      <Text className="text-xs text-neutral-500">{block.label ?? "Embedded content from the agent"}</Text>
    </View>
  );
}
