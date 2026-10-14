import { Linking, Pressable, Text, View } from "react-native";

export function UrlBar({ url, onReload }: { url: string; onReload: () => void }) {
  return (
    <View className="flex-row items-center gap-4 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
      <Text numberOfLines={1} className="flex-1 text-sm text-neutral-500">
        {url.replace(/^https?:\/\//, "")}
      </Text>
      <Pressable hitSlop={8} onPress={onReload}>
        <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Reload</Text>
      </Pressable>
      <Pressable hitSlop={8} onPress={() => Linking.openURL(url)}>
        <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Open</Text>
      </Pressable>
    </View>
  );
}
