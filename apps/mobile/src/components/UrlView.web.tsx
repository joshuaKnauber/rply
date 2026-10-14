import { useState } from "react";
import { View } from "react-native";
import { UrlBar } from "./UrlBar";

export function UrlView({ url }: { url: string }) {
  const [reloads, setReloads] = useState(0);
  return (
    <View className="flex-1">
      <UrlBar url={url} onReload={() => setReloads((n) => n + 1)} />
      <iframe
        key={reloads}
        src={url}
        title={url}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
        style={{ flex: 1, width: "100%", border: 0, background: "white" }}
      />
    </View>
  );
}
