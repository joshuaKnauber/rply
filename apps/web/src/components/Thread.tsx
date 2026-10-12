import { useEffect, useLayoutEffect, useMemo, useRef, type UIEvent } from "react";
import { CheckCheckIcon, CircleDotIcon, CornerDownRightIcon, EyeIcon, MessageCircleQuestionIcon } from "lucide-react";
import { toast } from "sonner";
import type { Answers, Message, MessageState } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { markRead, type StoredChannel } from "@/lib/channels";
import { MessageContext } from "@/lib/channel-context";
import { eventLabel, isCall, isWaiting } from "@rply/schema";
import { askStatus, formatTime, isAnswer, isEvent } from "@/lib/format";
import { useMessages, useSendMessage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Markdown } from "./blocks/Markdown";
import { AttachmentList } from "./blocks/Attachments";
import { MessageBlocks } from "./blocks/MessageBlocks";
import { Composer } from "./Composer";

export function Thread({ entry }: { entry: StoredChannel }) {
  const { data: messages = [], isPending, error } = useMessages(entry);
  const send = useSendMessage(entry);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const answersById = useMemo(() => new Map(messages.filter(isAnswer).map((m) => [m.id, (m.body as { answers: Answers }).answers])), [messages]);
  const visible = messages.filter((m) => !isAnswer(m));

  const lastSeq = messages.at(-1)?.seq;
  useEffect(() => {
    if (lastSeq) markRead(entry.channel.id, lastSeq);
  }, [lastSeq, entry.channel.id]);

  const lastVisible = visible.at(-1)?.id;
  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  };
  useLayoutEffect(scrollToBottom, [lastVisible]);
  useEffect(() => {
    const observer = new ResizeObserver(scrollToBottom);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const answer = (message: Message) => (answers: Answers) =>
    send.mutate({ reply_to: message.id, body: { answers } }, { onError: (err) => toast.error(err.message) });
  const sendEvent = (message: Message) => (blockId: string | null, value: unknown, label?: string) =>
    send.mutate({ reply_to: message.id, body: { event: { block_id: blockId, value: value as never, label } } }, { onError: (err) => toast.error(err.message) });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-6" onScroll={onScroll}>
        <div ref={contentRef} className="mx-auto flex max-w-3xl flex-col gap-1">
          {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
          {error && <p className="text-destructive text-sm">{error.message}</p>}
          {!isPending && visible.length === 0 && <p className="text-muted-foreground text-sm">No messages yet.</p>}
          {visible.map((message) =>
            isEvent(message) || isCall(message) ? (
              <EventLine key={message.id} message={message} />
            ) : (
              <MessageView
                key={message.id}
                message={message}
                agentName={entry.channel.name}
                submitted={message.ask?.answer_id ? answersById.get(message.ask.answer_id) : undefined}
                onAnswer={entry.revoked ? undefined : answer(message)}
                onEvent={entry.revoked ? undefined : sendEvent(message)}
              />
            ),
          )}
        </div>
      </div>
      {!entry.revoked && (
        <Composer
          disabled={send.isPending}
          onSend={(text, attachments) => {
            atBottom.current = true;
            send.mutate(
              { body: { ...(text && { text }), ...(attachments.length && { attachments }) } },
              { onError: (err) => toast.error(err.message) },
            );
          }}
        />
      )}
    </div>
  );
}

export function WaitingIndicator({ entry }: { entry: StoredChannel }) {
  const { data: messages = [] } = useMessages(entry);
  const waiting = messages.filter((m) => !isAnswer(m) && isWaiting(m));
  if (waiting.length === 0) return null;
  const label = waiting.length === 1 ? "Waiting for your reply" : `${waiting.length} waiting for your reply`;
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      onClick={() => document.getElementById(`msg-${waiting[0]!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
    >
      <MessageCircleQuestionIcon className="text-attention" />
    </Button>
  );
}

function EventLine({ message }: { message: Message }) {
  const body = message.enc ? undefined : message.body;
  const label = body && "call" in body && body.call ? `Called ${body.call.name}` : body && "event" in body && body.event ? `Sent: ${eventLabel(body.event)}` : "";
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-1 text-xs">
      <CornerDownRightIcon className="size-3" />
      <span className="max-w-[70%] truncate">{label}</span>
      <span className="tabular-nums">{formatTime(message.created_at)}</span>
      {message.state && <StateLabel state={message.state} />}
    </div>
  );
}

function MessageView({
  message,
  agentName,
  submitted,
  onAnswer,
  onEvent,
}: {
  message: Message;
  agentName: string;
  submitted?: Answers;
  onAnswer?: (answers: Answers) => void;
  onEvent?: (blockId: string | null, value: unknown, label?: string) => void;
}) {
  const fromAgent = message.sender === "agent";

  const content = (() => {
    if (message.enc) return <p className="text-muted-foreground italic">Encrypted message</p>;
    const body = message.body;
    return (
      <div className="flex flex-col gap-3">
        {"title" in body && body.title && <p className="font-semibold">{body.title}</p>}
        {body.text && (fromAgent ? <Markdown text={body.text} /> : <p className="whitespace-pre-wrap">{body.text}</p>)}
        {"attachments" in body && body.attachments?.length ? <AttachmentList attachments={body.attachments} /> : null}
        {"blocks" in body && body.blocks?.length ? (
          <MessageContext.Provider value={message}>
            <MessageBlocks blocks={body.blocks} status={askStatus(message.ask)} submitted={submitted} onSubmit={onAnswer} onEvent={onEvent} />
          </MessageContext.Provider>
        ) : null}
      </div>
    );
  })();

  return (
    <div
      id={`msg-${message.id}`}
      className={cn("flex flex-col gap-1.5 rounded-md border-l-2 border-transparent px-3 py-2.5", !fromAgent && "bg-muted", isWaiting(message) && "border-attention rounded-l-none")}
    >
      <div className="flex items-baseline gap-2 text-xs">
        <span className="font-medium">{fromAgent ? agentName : "You"}</span>
        <span className="text-muted-foreground tabular-nums">{formatTime(message.created_at)}</span>
        {message.updated_at && <span className="text-muted-foreground">edited</span>}
        {message.state && <StateLabel state={message.state} />}
      </div>
      {content}
    </div>
  );
}

const states: Record<MessageState, { label: string; icon: typeof EyeIcon }> = {
  seen: { label: "Seen", icon: EyeIcon },
  working: { label: "Working on it", icon: CircleDotIcon },
  done: { label: "Done", icon: CheckCheckIcon },
};

function StateLabel({ state }: { state: MessageState }) {
  const { label, icon: Icon } = states[state];
  return (
    <span className={cn("flex items-center gap-1", "text-muted-foreground", state === "done" && "text-foreground")}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}
