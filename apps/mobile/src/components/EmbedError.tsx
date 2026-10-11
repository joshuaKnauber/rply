import { Pressable, Text, View } from "react-native";

export function EmbedError({ message, onSend, onDismiss }: { message: string; onSend?: () => void; onDismiss: () => void }) {
  return (
    <View className="flex-row items-center gap-3 bg-red-50 px-3 py-2 dark:bg-red-950">
      <Text numberOfLines={2} className="flex-1 text-sm text-red-700 dark:text-red-300">
        This app hit an error: {message}
      </Text>
      {onSend && (
        <Pressable hitSlop={8} onPress={onSend}>
          <Text className="text-sm font-medium text-red-700 dark:text-red-300">Send to agent</Text>
        </Pressable>
      )}
      <Pressable hitSlop={8} onPress={onDismiss} accessibilityLabel="Dismiss">
        <Text className="text-sm text-red-700 dark:text-red-300">✕</Text>
      </Pressable>
    </View>
  );
}
