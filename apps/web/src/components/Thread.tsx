import { useEffect, useMemo, useRef } from "react";
import type { Message } from "@rply/schema";
import { markRead, type StoredChannel } from "@/lib/channels";
import { formatTime, formatValue } from "@/lib/format";
import { useMessages, useSendMessage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { BlockView } from "./blocks/BlockView";
import { Markdown } from "./blocks/Markdown";
import { Composer } from "./Composer";

export function Thread({ entry }: { entry: StoredChannel }) {
  const { data: messages = [], isPending, error } = useMessages(entry);
  const send = useSendMessage(entry);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    bottomRef.current?.scrollIntoView({ block: "end" });
    if (lastSeq) markRead(entry.channel.id, lastSeq);
  }, [lastSeq, entry.channel.id]);

  const onAction = (message: Message) => (elementId: string, value: unknown) =>
    send.mutate({ reply_to: message.id, body: { action: { element_id: elementId, value: value as never } } });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
          {error && <p className="text-destructive text-sm">{error.message}</p>}
          {!isPending && messages.length === 0 && <p className="text-muted-foreground text-sm">No messages yet.</p>}
          {messages.map((message) => (
            <MessageView key={message.id} message={message} answers={answers} onAction={entry.revoked ? undefined : onAction(message)} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      {!entry.revoked && <Composer disabled={send.isPending} onSend={(text) => send.mutate({ body: { text } })} />}
    </div>
  );
}

function MessageView({
  message,
  answers,
  onAction,
}: {
  message: Message;
  answers: Map<string, unknown>;
  onAction?: (elementId: string, value: unknown) => void;
}) {
  const fromAgent = message.sender === "agent";

  const content = (() => {
    if (message.enc) return <p className="text-muted-foreground italic">Encrypted message</p>;
    const body = message.body;
    if ("action" in body && body.action) {
      return <p className="text-sm">↳ {formatValue(body.action.value)}</p>;
    }
    return (
      <div className="flex flex-col gap-3">
        {"title" in body && body.title && <p className="font-semibold">{body.title}</p>}
        {body.text && (fromAgent ? <Markdown text={body.text} /> : <p className="whitespace-pre-wrap">{body.text}</p>)}
        {"blocks" in body &&
          body.blocks?.map((block, i) => (
            <BlockView key={block.id ?? i} block={block} answer={block.id ? answers.get(`${message.id}:${block.id}`) : undefined} onAction={onAction} />
          ))}
      </div>
    );
  })();

  return (
    <div className={cn("flex flex-col gap-1", fromAgent ? "items-start" : "items-end")}>
      <div className={cn("max-w-[85%] rounded-xl px-4 py-3", fromAgent ? "bg-card border" : "bg-primary text-primary-foreground")}>{content}</div>
      <span className="text-muted-foreground px-1 text-xs">{formatTime(message.created_at)}</span>
    </div>
  );
}
