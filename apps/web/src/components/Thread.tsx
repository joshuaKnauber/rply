import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type UIEvent } from "react";
import { CheckCheckIcon, CircleDotIcon, CornerDownRightIcon, EyeIcon, MessageCircleQuestionIcon, ReplyIcon } from "lucide-react";
import { toast } from "sonner";
import type { Answers, Message, MessageState, ChannelEntry } from "@rply/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { markRead } from "@/lib/channels";
import { MessageContext } from "@/lib/channel-context";
import { eventLabel, isCall, isWaiting } from "@rply/schema";
import { askStatus, formatClock, formatDay, formatTime, isAnswer, isEvent, preview } from "@/lib/format";
import { useMessages, useSendMessage } from "@/lib/queries";
import { useSwipeToReply } from "@/lib/swipe";
import { cn } from "@/lib/utils";
import { Markdown } from "./blocks/Markdown";
import { AttachmentList } from "./blocks/Attachments";
import { MessageBlocks } from "./blocks/MessageBlocks";
import { Composer } from "./Composer";

export function Thread({ entry }: { entry: ChannelEntry }) {
  const { data: messages = [], isPending, error } = useMessages(entry);
  const send = useSendMessage(entry);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const answersById = useMemo(() => new Map(messages.filter(isAnswer).map((m) => [m.id, (m.body as { answers: Answers }).answers])), [messages]);
  const visible = messages.filter((m) => !isAnswer(m));
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const queryClient = useQueryClient();
  const lastSeq = messages.at(-1)?.seq;
  useEffect(() => {
    if (lastSeq) markRead(queryClient, entry, lastSeq);
  }, [lastSeq, entry, queryClient]);

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
      <div ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-6" onScroll={onScroll}>
        <div ref={contentRef} className="mx-auto flex max-w-3xl flex-col">
          {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
          {error && <p className="text-destructive text-sm">{error.message}</p>}
          {!isPending && visible.length === 0 && <p className="text-muted-foreground text-sm">No messages yet.</p>}
          {visible.map((message, i) => {
            const prev = visible[i - 1];
            const next = visible[i + 1];
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(message.created_at).toDateString();
            const day = newDay && <DayDivider key={`day-${message.id}`} ts={message.created_at} />;
            if (isEvent(message) || isCall(message)) return [day, <EventLine key={message.id} message={message} />];
            return [
              day,
              <MessageView
                key={message.id}
                message={message}
                agentName={entry.name}
                quoted={message.reply_to ? byId.get(message.reply_to) : undefined}
                first={newDay || !sameGroup(prev, message)}
                last={!next || !sameGroup(message, next)}
                submitted={message.ask?.answer_id ? answersById.get(message.ask.answer_id) : undefined}
                onAnswer={answer(message)}
                onEvent={sendEvent(message)}
                onReply={message.ask || message.pin ? undefined : () => setReplyTo(message)}
              />,
            ];
          })}
        </div>
      </div>
      <Composer
        disabled={send.isPending}
        replyTo={replyTo && { name: replyTo.sender === "agent" ? entry.name : "You", text: preview(replyTo) }}
        onCancelReply={() => setReplyTo(null)}
        onSend={(text, attachments) => {
          atBottom.current = true;
          setReplyTo(null);
          send.mutate(
            { body: { ...(text && { text }), ...(attachments.length && { attachments }) }, ...(replyTo && { reply_to: replyTo.id }) },
            { onError: (err) => toast.error(err.message) },
          );
        }}
      />
    </div>
  );
}

export function WaitingIndicator({ entry }: { entry: ChannelEntry }) {
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

const GROUP_GAP = 5 * 60_000;
const sameGroup = (a: Message | undefined, b: Message) =>
  Boolean(a) && a!.sender === b.sender && !isEvent(a!) && !isCall(a!) && b.created_at - a!.created_at < GROUP_GAP;

function DayDivider({ ts }: { ts: number }) {
  return <div className="text-muted-foreground mt-4 mb-1 self-center text-xs font-medium">{formatDay(ts)}</div>;
}

function EventLine({ message }: { message: Message }) {
  const body = message.enc ? undefined : message.body;
  const label = body && "call" in body && body.call ? `Called ${body.call.name}` : body && "event" in body && body.event ? `Sent: ${eventLabel(body.event)}` : "";
  return (
    <div className="text-muted-foreground mt-1 flex items-center gap-1.5 self-end px-3 py-1 text-xs">
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
  quoted,
  first,
  last,
  submitted,
  onAnswer,
  onEvent,
  onReply,
}: {
  message: Message;
  agentName: string;
  quoted?: Message;
  first: boolean;
  last: boolean;
  submitted?: Answers;
  onAnswer?: (answers: Answers) => void;
  onEvent?: (blockId: string | null, value: unknown, label?: string) => void;
  onReply?: () => void;
}) {
  const fromAgent = message.sender === "agent";
  const lastTap = useRef(0);
  const swipe = useSwipeToReply(onReply);
  const wide = !message.enc && (("blocks" in message.body && message.body.blocks?.length) || ("attachments" in message.body && message.body.attachments?.length));

  const onPointerUp = (e: PointerEvent) => {
    swipe.end();
    if (e.pointerType !== "touch" || (e.target as Element).closest("a, button, input, textarea, select, label")) return;
    if (e.timeStamp - lastTap.current > 300) {
      lastTap.current = e.timeStamp;
      return;
    }
    lastTap.current = 0;
    const text = message.enc ? undefined : message.body.text || ("title" in message.body ? message.body.title : undefined);
    if (!text) return;
    getSelection()?.removeAllRanges();
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Couldn't copy"),
    );
  };

  const content = (() => {
    if (message.enc) return <p className="italic opacity-70">Encrypted message</p>;
    const body = message.body;
    return (
      <div className="flex flex-col gap-3">
        {"title" in body && body.title && <p className="font-semibold">{body.title}</p>}
        {body.text && (fromAgent ? <Markdown text={body.text} /> : <p className="whitespace-pre-wrap wrap-anywhere">{body.text}</p>)}
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
      className={cn("group/msg relative flex touch-pan-y flex-col", fromAgent ? "items-start" : "items-end", first ? "mt-3" : "mt-0.5")}
      {...swipe.handlers}
      onPointerUp={onPointerUp}
    >
      {first && fromAgent && <span className="text-muted-foreground mb-1 text-xs font-medium">{agentName}</span>}
      <ReplyIcon className="text-muted-foreground absolute top-1/2 left-0 size-4 -translate-y-1/2" style={{ opacity: swipe.progress, transform: `translateX(${swipe.offset / 2 - 24}px) scale(${0.6 + swipe.progress * 0.4})` }} />
      <div
        className={cn("flex items-center gap-1", fromAgent ? "w-full" : "max-w-[85%] flex-row-reverse", wide && "w-full", swipe.offset === 0 && "transition-transform")}
        style={{ transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined }}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 touch-manipulation flex-col gap-2",
            fromAgent
              ? isWaiting(message) && "ring-attention my-1 rounded-2xl px-3.5 py-2.5 ring-2"
              : ["bg-muted rounded-2xl px-3.5 py-2.5", !first && "rounded-tr-md", !last && "rounded-br-md"],
          )}
        >
          {quoted && <Quote message={quoted} agentName={agentName} />}
          {content}
        </div>
        {onReply && (
          <Button size="icon-xs" variant="ghost" className="text-muted-foreground opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden" aria-label="Reply" onClick={onReply}>
            <ReplyIcon />
          </Button>
        )}
      </div>
      {(last || message.state) && (
        <div className={cn("text-muted-foreground mt-1 flex items-baseline gap-2 text-xs", !fromAgent && "px-3")}>
          <span className="tabular-nums">{formatClock(message.created_at)}</span>
          {message.updated_at && <span>edited</span>}
          {message.state && <StateLabel state={message.state} />}
        </div>
      )}
    </div>
  );
}

function Quote({ message, agentName }: { message: Message; agentName: string }) {
  return (
    <button
      type="button"
      className="border-attention bg-current/7 -mx-1 flex min-w-0 flex-col rounded-lg border-l-2 px-2.5 py-1.5 text-left text-sm"
      onClick={() => document.getElementById(`msg-${message.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
    >
      <span className="text-xs font-medium">{message.sender === "agent" ? agentName : "You"}</span>
      <span className="line-clamp-2 opacity-80">{preview(message)}</span>
    </button>
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
