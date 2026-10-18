import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Answers, BlockOf, Message, MessageState } from "@rply/schema";
import { AttachmentList } from "@/components/Attachments";
import { Composer } from "@/components/Composer";
import { HtmlBlock } from "@/components/HtmlBlock";
import { Markdown } from "@/components/Markdown";
import { MessageBlocks } from "@/components/MessageBlocks";
import { UrlView } from "@/components/UrlView";
import { auth, channelsKey, markRead, useChannels, type ServerChannel } from "@/lib/channels";
import { ChannelContext, MessageContext } from "@/lib/channel-context";
import { appTitle, appUrl, eventLabel, isApp, isCall, isWaiting, preview } from "@rply/schema";
import { askStatus, formatTime, isAnswer, isEvent } from "@/lib/format";
import { useAgents, useMessages, usePins, useSendMessage, useUnpin } from "@/lib/queries";

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useChannels().find((c) => c.channel.id === id);
  const [tab, setTab] = useState<string | null>(null);
  const queryClient = useQueryClient();

  if (!entry) return <Text className="p-6 text-neutral-500">Channel not found.</Text>;

  const deleteChannel = () =>
    Alert.alert(`Delete "${entry.channel.name}"?`, "This deletes the channel with all its messages, files and apps for everyone. Its agents lose access. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          api(entry.server, "/channel", { ...auth(entry), method: "DELETE" })
            .then(() => queryClient.invalidateQueries({ queryKey: channelsKey(entry.server) }))
            .then(() => router.back())
            .catch((err: Error) => Alert.alert("Couldn't delete", err.message)),
      },
    ]);

  return (
    <KeyboardAvoidingView className="flex-1 bg-white dark:bg-neutral-950" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen
        options={{
          title: entry.channel.name,
          headerRight: () =>
            entry.channel.role === "owner" ? (
              <Pressable onPress={deleteChannel}>
                <Text className="text-red-600">Delete</Text>
              </Pressable>
            ) : null,
        }}
      />
      <ChannelContext.Provider value={entry}>
        <Body entry={entry} tab={tab} setTab={setTab} />
      </ChannelContext.Provider>
    </KeyboardAvoidingView>
  );
}

function Body({ entry, tab, setTab }: { entry: ServerChannel; tab: string | null; setTab: (tab: string | null) => void }) {
  const { data: pins = [] } = usePins(entry);
  const apps = pins.filter(isApp);
  const app = apps.find((m) => m.pin === tab);

  return (
    <>
      {apps.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0 border-b border-neutral-200 dark:border-neutral-800" contentContainerClassName="gap-1 px-2 py-2">
          {[{ key: null, label: "Chat" }, ...apps.map((m) => ({ key: m.pin, label: appTitle(m) }))].map((t) => {
            const active = (app?.pin ?? null) === t.key;
            return (
              <Pressable key={t.key ?? ""} onPress={() => setTab(t.key)} className={`rounded-lg px-3 py-1.5 ${active ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
                <Text className={`text-sm font-medium ${active ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500"}`}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {app ? (
        <AppView entry={entry} app={app} />
      ) : (
        <>
          <Pinned entry={entry} pins={pins.filter((m) => !isApp(m))} />
          <Thread entry={entry} />
        </>
      )}
    </>
  );
}

function AppView({ entry, app }: { entry: ServerChannel; app: Message }) {
  const send = useSendMessage(entry);
  const body = app.enc ? null : app.body;
  const blocks = body && "blocks" in body ? (body.blocks ?? []) : [];
  const only = blocks.length === 1 && !body?.text && blocks[0]!.type === "html" ? (blocks[0] as BlockOf<"html">) : undefined;
  const onEvent = (blockId: string | null, value: unknown, label?: string) =>
    send.mutate({ reply_to: app.id, body: { event: { block_id: blockId, value: value as never, label } } }, { onError: (err) => Alert.alert("Couldn't send", err.message) });
  const url = appUrl(app);
  if (url) return <UrlView key={app.id} url={url} />;

  return (
    <MessageContext.Provider value={app}>
      {only ? (
        <HtmlBlock key={app.id} block={only} fill onSend={(value, label) => onEvent(only.id ?? null, value, label)} />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4">
          {!body && <Text className="italic text-neutral-500">Encrypted</Text>}
          {body?.text && <Markdown text={body.text} />}
          {blocks.length > 0 && <MessageBlocks blocks={blocks} status={null} onEvent={onEvent} />}
        </ScrollView>
      )}
    </MessageContext.Provider>
  );
}

function Pinned({ entry, pins }: { entry: ServerChannel; pins: Message[] }) {
  const send = useSendMessage(entry);
  const unpin = useUnpin(entry);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [contentHeight, setContentHeight] = useState(0);
  if (pins.length === 0) return null;

  return (
    <View className="border-b border-neutral-200 dark:border-neutral-800">
      <ScrollView style={{ height: Math.min(contentHeight, 320) }} onContentSizeChange={(_, h) => setContentHeight(h)} contentContainerClassName="gap-2 p-2">
      {pins.map((message) => {
        const body = message.enc ? null : message.body;
        const title = (body && "title" in body && body.title) || (message.pin === "status" ? "Status" : message.pin);
        const expanded = open[message.id] ?? true;
        return (
          <View key={message.id} className="rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            <Pressable onPress={() => setOpen((o) => ({ ...o, [message.id]: !expanded }))} className="flex-row items-center gap-2 px-3 py-2">
              <Text className="text-neutral-500">📌</Text>
              <Text numberOfLines={1} className="flex-1 font-medium text-neutral-900 dark:text-neutral-100">
                {title}
              </Text>
              <Text className="text-xs text-neutral-500">{formatTime(message.updated_at ?? message.created_at)}</Text>
              <Text className="text-neutral-500">{expanded ? "▾" : "▸"}</Text>
              <Pressable
                hitSlop={8}
                onPress={() => unpin.mutate(message.id, { onError: (err) => Alert.alert("Couldn't unpin", err.message) })}
                className="ml-1 rounded-md px-1.5 py-0.5"
              >
                <Text className="text-xs font-medium text-neutral-500">Unpin</Text>
              </Pressable>
            </Pressable>
            {expanded && (
              <View className="gap-3 px-3 pb-3">
                {!body && <Text className="italic text-neutral-500">Encrypted</Text>}
                {body?.text && <Markdown text={body.text} />}
                {body && "blocks" in body && body.blocks?.length ? (
                  <MessageContext.Provider value={message}>
                    <MessageBlocks
                      blocks={body.blocks}
                      status={null}
                      onEvent={(blockId, value, label) => send.mutate({ reply_to: message.id, body: { event: { block_id: blockId, value: value as never, label } } })}
                    />
                  </MessageContext.Provider>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

function Thread({ entry }: { entry: ServerChannel }) {
  const { data: messages = [], isPending, error } = useMessages(entry);
  const send = useSendMessage(entry);
  const list = useRef<FlatList<Message>>(null);

  const answersById = useMemo(() => new Map(messages.filter(isAnswer).map((m) => [m.id, (m.body as { answers: Answers }).answers])), [messages]);
  const visible = messages.filter((m) => !isAnswer(m));
  const waiting = visible.filter(isWaiting);

  const queryClient = useQueryClient();
  const lastSeq = messages.at(-1)?.seq;
  useEffect(() => {
    if (lastSeq) markRead(queryClient, entry, lastSeq);
  }, [lastSeq, entry, queryClient]);

  const several = (useAgents(entry).data?.length ?? 0) > 1;
  const answer = (message: Message) => (answers: Answers) =>
    send.mutate({ reply_to: message.id, body: { answers } }, { onError: (err) => Alert.alert("Couldn't send", err.message) });
  const sendEvent = (message: Message) => (blockId: string | null, value: unknown, label?: string) =>
    send.mutate({ reply_to: message.id, body: { event: { block_id: blockId, value: value as never, label } } }, { onError: (err) => Alert.alert("Couldn't send", err.message) });

  return (
    <View className="flex-1">
      <FlatList
        ref={list}
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerClassName="gap-3 p-4"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text className="text-neutral-500">{isPending ? "Loading…" : error ? error.message : "No messages yet."}</Text>}
        renderItem={({ item }) =>
          item.sender === "system" ? (
            <Text className="self-center text-xs text-neutral-500">{preview(item)}</Text>
          ) : isEvent(item) || isCall(item) ? (
            <Text className="self-end px-1 text-xs text-neutral-500">
              ↳ {actionLabel(item)} · {formatTime(item.created_at)}
              {item.state ? ` · ${stateLabels[item.state].label}` : ""}
            </Text>
          ) : (
            <MessageView
              message={item}
              author={several ? (item.agent?.label ?? undefined) : undefined}
              submitted={item.ask?.answer_id ? answersById.get(item.ask.answer_id) : undefined}
              onAnswer={answer(item)}
              onEvent={sendEvent(item)}
            />
          )
        }
      />
      {waiting.length > 0 && (
        <Pressable
          onPress={() => list.current?.scrollToIndex({ index: visible.indexOf(waiting[0]!), viewPosition: 0.3 })}
          className="mx-3 mb-1 self-start rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"
        >
          <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {waiting.length === 1 ? "Something is waiting for your reply" : `${waiting.length} things are waiting for your reply`}
          </Text>
        </Pressable>
      )}
      <Composer
        entry={entry}
        disabled={send.isPending}
        onSend={(text, attachments) =>
          send.mutate(
            { body: { ...(text ? { text } : {}), ...(attachments.length ? { attachments } : {}) } },
            { onError: (err) => Alert.alert("Couldn't send", err.message) },
          )
        }
      />
    </View>
  );
}

function actionLabel(message: Message) {
  const body = message.enc ? undefined : message.body;
  if (body && "call" in body && body.call) return `Called ${body.call.name}`;
  return body && "event" in body && body.event ? `Sent: ${eventLabel(body.event)}` : "";
}

const stateLabels: Record<MessageState, { label: string; className: string }> = {
  seen: { label: "Seen", className: "text-neutral-500" },
  working: { label: "Working on it", className: "text-amber-600 dark:text-amber-400" },
  done: { label: "Done ✓", className: "text-emerald-600 dark:text-emerald-400" },
};

function MessageView({
  message,
  author,
  submitted,
  onAnswer,
  onEvent,
}: {
  message: Message;
  author?: string;
  submitted?: Answers;
  onAnswer?: (answers: Answers) => void;
  onEvent?: (blockId: string | null, value: unknown, label?: string) => void;
}) {
  const fromAgent = message.sender === "agent";
  const textColor = fromAgent ? "text-neutral-900 dark:text-neutral-100" : "text-white dark:text-neutral-900";
  const status = askStatus(message.ask);
  const lastTap = useRef(0);
  const [copied, setCopied] = useState(false);

  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current > 300) {
      lastTap.current = now;
      return;
    }
    lastTap.current = 0;
    const text = message.enc ? undefined : message.body.text || ("title" in message.body ? message.body.title : undefined);
    if (!text) return;
    Clipboard.setStringAsync(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const content = (() => {
    if (message.enc) return <Text className="italic text-neutral-500">Encrypted message</Text>;
    const body = message.body;
    return (
      <View className="gap-3">
        {"title" in body && body.title && <Text className={`font-semibold ${textColor}`}>{body.title}</Text>}
        {body.text && (fromAgent ? <Markdown text={body.text} /> : <Text className={`text-[15px] leading-6 ${textColor}`}>{body.text}</Text>)}
        {"attachments" in body && body.attachments?.length ? <AttachmentList attachments={body.attachments} /> : null}
        {"blocks" in body && body.blocks?.length ? (
          <MessageContext.Provider value={message}>
            <MessageBlocks blocks={body.blocks} status={status} submitted={submitted} onSubmit={onAnswer} onEvent={onEvent} />
          </MessageContext.Provider>
        ) : null}
      </View>
    );
  })();

  return (
    <View className={`gap-1 ${fromAgent ? "items-start" : "items-end"}`}>
      <Pressable
        onPress={onPress}
        className={`rounded-2xl px-4 py-3 ${status === "open" || message.ask ? "w-[90%]" : "max-w-[85%]"} ${
          fromAgent ? "border bg-white dark:bg-neutral-900" : "bg-neutral-900 dark:bg-neutral-100"
        } ${status === "open" ? "border-neutral-400 dark:border-neutral-500" : "border-neutral-200 dark:border-neutral-800"}`}
      >
        {content}
      </Pressable>
      <Text className="px-1 text-xs text-neutral-500">
        {copied ? "Copied · " : ""}
        {author ? `${author} · ` : ""}
        {formatTime(message.created_at)}
        {message.updated_at ? " · edited" : ""}
        {message.state && (
          <Text className={stateLabels[message.state].className}>
            {" "}
            · {stateLabels[message.state].label}
            {message.state === "working" && message.state_note ? ` · ${message.state_note}` : ""}
          </Text>
        )}
      </Text>
    </View>
  );
}
