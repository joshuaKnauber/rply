import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import type { Message } from "@rply/schema";
import { BlockView } from "@/components/BlockView";
import { markRead, removeChannel, useChannels, type StoredChannel } from "@/lib/channels";
import { formatTime, formatValue } from "@/lib/format";
import { useMessages, useSendMessage, useStatus } from "@/lib/queries";

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useChannels().find((c) => c.channel.id === id);
  const [tab, setTab] = useState<"chat" | "status">("chat");

  if (!entry) return <Text className="p-6 text-neutral-500">Channel not found.</Text>;

  const remove = () =>
    Alert.alert(`Remove "${entry.channel.name}"?`, "It stays on the server. You can pair again later.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => (removeChannel(entry.channel.id), router.back()) },
    ]);

  return (
    <KeyboardAvoidingView className="flex-1 bg-white dark:bg-neutral-950" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen
        options={{
          title: entry.channel.name,
          headerRight: entry.admin
            ? undefined
            : () => (
                <Pressable onPress={remove}>
                  <Text className="text-red-600">Remove</Text>
                </Pressable>
              ),
        }}
      />
      <View className="flex-row gap-1 border-b border-neutral-200 p-2 dark:border-neutral-800">
        {(["chat", "status"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} className={`flex-1 items-center rounded-md py-1.5 ${tab === t ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
            <Text className={`font-medium capitalize ${tab === t ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500"}`}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "chat" ? <Thread entry={entry} /> : <StatusView entry={entry} />}
    </KeyboardAvoidingView>
  );
}

function Thread({ entry }: { entry: StoredChannel }) {
  const { data: messages = [], isPending, error } = useMessages(entry);
  const send = useSendMessage(entry);
  const [text, setText] = useState("");
  const list = useRef<FlatList<Message>>(null);

  const answers = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const m of messages) {
      if (m.enc || m.sender !== "human" || !m.reply_to || !("action" in m.body) || !m.body.action) continue;
      const key = `${m.reply_to}:${m.body.action.element_id}`;
      if (!map.has(key)) map.set(key, m.body.action.value);
    }
    return map;
  }, [messages]);

  const lastSeq = messages.at(-1)?.seq;
  useEffect(() => {
    if (lastSeq) markRead(entry.channel.id, lastSeq);
  }, [lastSeq, entry.channel.id]);

  const submit = () => {
    if (!text.trim()) return;
    send.mutate({ body: { text: text.trim() } });
    setText("");
  };

  return (
    <View className="flex-1">
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerClassName="gap-3 p-4"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text className="text-neutral-500">{isPending ? "Loading…" : error ? error.message : "No messages yet."}</Text>}
        renderItem={({ item }) => (
          <MessageView
            message={item}
            answers={answers}
            onAction={entry.revoked ? undefined : (elementId, value) => send.mutate({ reply_to: item.id, body: { action: { element_id: elementId, value: value as never } } })}
          />
        )}
      />
      {!entry.revoked && (
        <View className="flex-row items-end gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
          <TextInput
            className="max-h-32 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            multiline
            placeholder="Message the agent…"
            value={text}
            onChangeText={setText}
          />
          <Pressable onPress={submit} disabled={!text.trim() || send.isPending} className={`rounded-lg bg-neutral-900 px-4 py-2.5 dark:bg-neutral-100 ${!text.trim() ? "opacity-40" : ""}`}>
            <Text className="font-medium text-white dark:text-neutral-900">Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function MessageView({ message, answers, onAction }: { message: Message; answers: Map<string, unknown>; onAction?: (elementId: string, value: unknown) => void }) {
  const fromAgent = message.sender === "agent";
  const textColor = fromAgent ? "text-neutral-900 dark:text-neutral-100" : "text-white dark:text-neutral-900";

  const content = (() => {
    if (message.enc) return <Text className="italic text-neutral-500">Encrypted message</Text>;
    const body = message.body;
    if ("action" in body && body.action) return <Text className={textColor}>↳ {formatValue(body.action.value)}</Text>;
    return (
      <View className="gap-3">
        {"title" in body && body.title && <Text className={`font-semibold ${textColor}`}>{body.title}</Text>}
        {body.text && <Text className={`text-[15px] leading-6 ${textColor}`}>{body.text}</Text>}
        {"blocks" in body &&
          body.blocks?.map((block, i) => (
            <BlockView key={block.id ?? i} block={block} answer={block.id ? answers.get(`${message.id}:${block.id}`) : undefined} onAction={onAction} />
          ))}
      </View>
    );
  })();

  return (
    <View className={`gap-1 ${fromAgent ? "items-start" : "items-end"}`}>
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${fromAgent ? "border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" : "bg-neutral-900 dark:bg-neutral-100"}`}
      >
        {content}
      </View>
      <Text className="px-1 text-xs text-neutral-500">{formatTime(message.created_at)}</Text>
    </View>
  );
}

function StatusView({ entry }: { entry: StoredChannel }) {
  const { data: status, isPending } = useStatus(entry);
  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      {isPending && <Text className="text-neutral-500">Loading…</Text>}
      {!isPending && !status && <Text className="text-neutral-500">This agent hasn't published a status page yet.</Text>}
      {status?.enc && <Text className="italic text-neutral-500">Encrypted status page</Text>}
      {status && !status.enc && (
        <>
          {status.body.blocks.map((block, i) => (
            <BlockView key={block.id ?? i} block={block} />
          ))}
          <Text className="text-xs text-neutral-500">Updated {formatTime(status.updated_at)}</Text>
        </>
      )}
    </ScrollView>
  );
}
