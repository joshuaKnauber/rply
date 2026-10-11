import { useState } from "react";
import { Linking, Text, useColorScheme, View } from "react-native";
import { WebView } from "react-native-webview";
import { embedDocument, type BlockOf } from "@rply/schema";


type Props = { block: BlockOf<"html">; onReply?: (value: unknown) => void; onSend?: (value: unknown, label?: string) => void };

export function HtmlBlock({ block, onReply, onSend }: Props) {
  const [height, setHeight] = useState(block.height ?? 150);
  const scheme = useColorScheme();

  return (
    <View className="gap-1">
      <View style={{ height: height + 2 }} className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <WebView
          originWhitelist={["*"]}
          source={{ html: embedDocument(block, "native", scheme === "dark" ? "dark" : "light") }}
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
