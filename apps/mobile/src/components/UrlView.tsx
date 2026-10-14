import { useRef } from "react";
import { Linking, View } from "react-native";
import { WebView } from "react-native-webview";
import { UrlBar } from "./UrlBar";

export function UrlView({ url }: { url: string }) {
  const webview = useRef<WebView>(null);
  return (
    <View className="flex-1">
      <UrlBar url={url} onReload={() => webview.current?.reload()} />
      <WebView
        ref={webview}
        source={{ uri: url }}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => {
          if (/^https?:\/\//.test(req.url) || req.url === "about:blank") return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
    </View>
  );
}
