import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { BlockOf } from "@rply/schema";

const bridge = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>
window.rply = {
  reply: (value) => window.ReactNativeWebView.postMessage(JSON.stringify({ rply: "reply", value })),
  send: (value, label) => window.ReactNativeWebView.postMessage(JSON.stringify({ rply: "send", value, label })),
  resize: (height) => window.ReactNativeWebView.postMessage(JSON.stringify({ rply: "resize", height })),
};
addEventListener("load", () => {
  const report = () => rply.resize(Math.ceil(Math.max(document.body.scrollHeight, document.body.getBoundingClientRect().height)));
  new ResizeObserver(report).observe(document.body);
  report();
});
</script>
<style>html,body{margin:0;font-family:system-ui,sans-serif;color-scheme:light dark}body{display:flow-root}</style>`;
const autoHeight = `<style>html,body{overflow:hidden}</style>`;

type Props = { block: BlockOf<"html">; onReply?: (value: unknown) => void; onSend?: (value: unknown, label?: string) => void };

export function HtmlBlock({ block, onReply, onSend }: Props) {
  const [height, setHeight] = useState(block.height ?? 150);

  return (
    <View className="gap-1">
      <View style={{ height: height + 2 }} className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <WebView
          originWhitelist={["*"]}
          source={{ html: bridge + (block.height ? "" : autoHeight) + block.html }}
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
              if (data.rply === "send") onSend?.(data.value, typeof data.label === "string" ? data.label : undefined);
            } catch {}
          }}
        />
      </View>
      <Text className="text-xs text-neutral-500">{block.label ?? "Embedded content from the agent"}</Text>
    </View>
  );
}
