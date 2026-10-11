import { FlatList, Pressable, Text, View } from "react-native";
import { Link, Stack, router } from "expo-router";
import type { Message } from "@rply/schema";
import { useChannels, useReadSeqs } from "@/lib/channels";
import { isWaiting } from "@rply/schema";
import { formatTime, isAnswer, preview } from "@/lib/format";
import { useAllMessages } from "@/lib/queries";

export default function Inbox() {
  const channels = useChannels();
  const results = useAllMessages(channels);
  const readSeqs = useReadSeqs();

  const rows = channels
    .map((entry, i) => {
      const messages: Message[] = results[i]?.data ?? [];
      const last = messages.filter((m) => !isAnswer(m)).at(-1);
      const unread = messages.filter((m) => m.sender === "agent" && m.seq > (readSeqs[entry.channel.id] ?? 0)).length;
      const waiting = messages.some(isWaiting);
      return { entry, last, unread, waiting };
    })
    .sort((a, b) => (b.last?.created_at ?? b.entry.channel.created_at) - (a.last?.created_at ?? a.entry.channel.created_at));

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen
        options={{
          headerRight: () => (
            <View className="flex-row gap-4">
              <Link href="/owner" className="text-base text-neutral-900 dark:text-neutral-100">
                Owner
              </Link>
              <Link href="/add" className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Add
              </Link>
            </View>
          ),
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => `${row.entry.server}/${row.entry.channel.id}`}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          <View className="gap-2 p-6">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">No channels yet</Text>
            <Text className="text-neutral-500 dark:text-neutral-400">
              Run `rply pair` on your agent's machine and paste the link under Add, or sign in as the server owner.
            </Text>
          </View>
        }
        renderItem={({ item: { entry, last, unread, waiting } }) => (
          <Pressable
            onPress={() => router.push(`/channel/${entry.channel.id}`)}
            className="gap-0.5 border-b border-neutral-200 px-4 py-3 active:bg-neutral-100 dark:border-neutral-800 dark:active:bg-neutral-900"
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text numberOfLines={1} className="flex-1 font-semibold text-neutral-900 dark:text-neutral-100">
                {entry.channel.name}
              </Text>
              {last && <Text className="text-xs text-neutral-500">{formatTime(last.created_at)}</Text>}
            </View>
            <View className="flex-row items-center justify-between gap-2">
              <Text numberOfLines={1} className="flex-1 text-neutral-500 dark:text-neutral-400">
                {entry.revoked ? "Access revoked" : last ? preview(last) : "No messages yet"}
              </Text>
              {waiting && <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Needs reply</Text>}
              {unread > 0 && (
                <View className="rounded-full bg-neutral-900 px-1.5 dark:bg-neutral-100">
                  <Text className="text-xs font-medium text-white dark:text-neutral-900">{unread}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
