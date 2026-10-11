import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { BlockOf } from "@rply/schema";

const bridge = `<meta name="viewport" content="width=device-width,initial-scale=1">
<script>
window.rply = {
  reply: (value) => window.ReactNativeWebView.postMessage(JSON.stringify({ rply: "reply", value })),
  resize: (height) => window.ReactNativeWebView.postMessage(JSON.stringify({ rply: "resize", height })),
};
addEventListener("load", () => {
  new ResizeObserver(() => rply.resize(document.documentElement.scrollHeight)).observe(document.documentElement);
});
</script>
<style>html,body{margin:0;font-family:system-ui,sans-serif;color-scheme:light dark}</style>`;

type Props = { block: BlockOf<"html">; onReply?: (value: unknown) => void };

export function HtmlBlock({ block, onReply }: Props) {
  const [height, setHeight] = useState(block.height ?? 150);

  return (
    <View className="gap-1">
      <View style={{ height }} className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <WebView
          originWhitelist={["*"]}
          source={{ html: bridge + block.html }}
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(req) => {
            if (req.url === "about:blank" || req.url.startsWith("data:")) return true;
            if (/^https?:\/\//.test(req.url)) Linking.openURL(req.url);
            return false;
          }}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.rply === "resize" && !block.height) setHeight(Math.min(Math.max(Number(data.height) || 0, 40), 2000));
              if (data.rply === "reply") onReply?.(data.value);
            } catch {}
          }}
        />
      </View>
      <Text className="text-xs text-neutral-500">{block.label ?? "Embedded content from the agent"}</Text>
    </View>
  );
}
