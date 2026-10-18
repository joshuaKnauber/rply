import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode, type UIEvent } from "react";
import { CheckCheckIcon, CircleDotIcon, CornerDownRightIcon, EyeIcon, MessageCircleQuestionIcon, ReplyIcon } from "lucide-react";
import { toast } from "sonner";
import type { Answers, Message, MessageState, ChannelEntry } from "@rply/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { markRead } from "@/lib/channels";
import { MessageContext } from "@/lib/channel-context";
import { agentName, birdLook, eventLabel, isCall, isWaiting } from "@rply/schema";
import { askStatus, formatClock, formatDay, formatTime, isAnswer, isEvent, preview } from "@/lib/format";
import { openCustomizer } from "@/lib/customize";
import { useAgents, useMessages, useSendMessage } from "@/lib/queries";
import { useSwipeToReply } from "@/lib/swipe";
import { cn } from "@/lib/utils";
import { Markdown } from "./blocks/Markdown";
import { AttachmentList } from "./blocks/Attachments";
import { MessageBlocks } from "./blocks/MessageBlocks";
import { AgentAvatar, useAgentMoods } from "./AgentAvatar";
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
  const { data: agents = [] } = useAgents(entry);
  const several = agents.length > 1;
  const nameOf = (m: Message) => (m.sender === "agent" ? agentName(m, entry.name, several) : "You");
  const labels = new Map(agents.flatMap((a) => (a.label ? [[a.id, a.label] as const] : [])));

  const moods = useAgentMoods(agents, messages);
  const agentIdOf = (message: Message) => message.agent?.id ?? (agents.length === 1 ? agents[0]!.id : undefined);
  const customize = (message: Message) => {
    const id = agentIdOf(message);
    return id && agents.some((a) => a.id === id) ? () => openCustomizer(entry, id) : undefined;
  };
  const avatarFor = (message: Message, groupLastSeq: number) => {
    const id = agentIdOf(message);
    if (!id) return undefined;
    return (
      <AgentAvatar
        look={birdLook(id, agents)}
        mood={moods.get(id) ?? "offline"}
        size={28}
        group={entry.id}
        chirp={groupLastSeq}
        chirpOnMount={Date.now() - message.created_at < 10_000}
        dot={false}
        onClick={customize(message)}
        title="Customize"
      />
    );
  };

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
            const first = newDay || !sameGroup(prev, message, several);
            let groupEnd = i;
            while (first && visible[groupEnd + 1] && sameGroup(visible[groupEnd], visible[groupEnd + 1]!, several)) groupEnd++;
            const day = newDay && <DayDivider key={`day-${message.id}`} ts={message.created_at} />;
            if (isEvent(message) || isCall(message)) return [day, <EventLine key={message.id} message={message} />];
            return [
              day,
              <MessageView
                key={message.id}
                message={message}
                nameOf={nameOf}
                mentionLabels={message.mentions?.flatMap((id) => labels.get(id) ?? []) ?? []}
                quoted={message.reply_to ? byId.get(message.reply_to) : undefined}
                first={first}
                avatar={first && message.sender === "agent" ? avatarFor(message, visible[groupEnd]!.seq) : undefined}
                onAgent={first ? customize(message) : undefined}
                last={!next || !sameGroup(message, next, several)}
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
        replyTo={replyTo && { name: nameOf(replyTo), text: preview(replyTo) }}
        onCancelReply={() => setReplyTo(null)}
        agents={several ? agents.map((a) => ({ id: a.id, label: a.label ?? "Agent" })) : []}
        onSend={(text, attachments, mentions) => {
          atBottom.current = true;
          setReplyTo(null);
          send.mutate(
            {
              body: { ...(text && { text }), ...(attachments.length && { attachments }) },
              ...(replyTo && { reply_to: replyTo.id }),
              ...(mentions.length && { mentions }),
            },
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
const sameGroup = (a: Message | undefined, b: Message, several: boolean) =>
  Boolean(a) && a!.sender === b.sender && (!several || a!.agent?.id === b.agent?.id) && !isEvent(a!) && !isCall(a!) && b.created_at - a!.created_at < GROUP_GAP;

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
      {message.state && <StateLabel state={message.state} note={message.state_note} />}
    </div>
  );
}

function MessageView({
  message,
  avatar,
  onAgent,
  nameOf,
  mentionLabels,
  quoted,
  first,
  last,
  submitted,
  onAnswer,
  onEvent,
  onReply,
}: {
  message: Message;
  avatar?: ReactNode;
  onAgent?: () => void;
  nameOf: (message: Message) => string;
  mentionLabels: string[];
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
        {body.text && (fromAgent ? <Markdown text={body.text} /> : <p className="whitespace-pre-wrap wrap-anywhere"><MentionText text={body.text} labels={mentionLabels} /></p>)}
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
      className={cn("group/msg relative flex touch-pan-y flex-col", fromAgent ? "items-start pl-10" : "items-end", first ? "mt-3" : "mt-0.5")}
      {...swipe.handlers}
      onPointerUp={onPointerUp}
    >
      {avatar && <div className="absolute top-0 left-0">{avatar}</div>}
      {first && fromAgent &&
        (onAgent ? (
          <button type="button" className="text-muted-foreground hover:text-foreground mb-1 text-xs font-medium" onClick={onAgent}>
            {nameOf(message)}
          </button>
        ) : (
          <span className="text-muted-foreground mb-1 text-xs font-medium">{nameOf(message)}</span>
        ))}
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
          {quoted && <Quote message={quoted} name={nameOf(quoted)} />}
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
          {message.state && <StateLabel state={message.state} note={message.state_note} />}
        </div>
      )}
    </div>
  );
}

function MentionText({ text, labels }: { text: string; labels: string[] }) {
  if (!labels.length) return text;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${labels.map((l) => escape(`@${l}`)).join("|")})`));
  return parts.map((part, i) => (i % 2 ? <span key={i} className="mention">{part}</span> : part));
}

function Quote({ message, name }: { message: Message; name: string }) {
  return (
    <button
      type="button"
      className="border-attention bg-current/7 -mx-1 flex min-w-0 flex-col rounded-lg border-l-2 px-2.5 py-1.5 text-left text-sm"
      onClick={() => document.getElementById(`msg-${message.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
    >
      <span className="text-xs font-medium">{name}</span>
      <span className="line-clamp-2 opacity-80">{preview(message)}</span>
    </button>
  );
}

const states: Record<MessageState, { label: string; icon: typeof EyeIcon }> = {
  seen: { label: "Seen", icon: EyeIcon },
  working: { label: "Working on it", icon: CircleDotIcon },
  done: { label: "Done", icon: CheckCheckIcon },
};

function StateLabel({ state, note }: { state: MessageState; note: string | null }) {
  const { label, icon: Icon } = states[state];
  return (
    <span className={cn("flex min-w-0 items-center gap-1", "text-muted-foreground", state === "done" && "text-foreground")}>
      <Icon className="size-3 shrink-0" />
      {label}
      {note && state === "working" && <span className="truncate">· {note}</span>}
    </span>
  );
}
