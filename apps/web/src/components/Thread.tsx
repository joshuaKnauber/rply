import { useEffect, useMemo, useRef } from "react";
import { CheckCheckIcon, CircleDotIcon, CornerDownRightIcon, EyeIcon, MessageCircleQuestionIcon } from "lucide-react";
import { toast } from "sonner";
import type { Answers, Message, MessageState } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { markRead, type StoredChannel } from "@/lib/channels";
import { eventLabel, isWaiting } from "@rply/schema";
import { askStatus, formatTime, isAnswer, isEvent } from "@/lib/format";
import { useMessages, useSendMessage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Markdown } from "./blocks/Markdown";
import { MessageBlocks } from "./blocks/MessageBlocks";
import { Composer } from "./Composer";

export function Thread({ entry }: { entry: StoredChannel }) {
  const { data: messages = [], isPending, error } = useMessages(entry);
  const send = useSendMessage(entry);
  const bottomRef = useRef<HTMLDivElement>(null);

  const answersById = useMemo(() => new Map(messages.filter(isAnswer).map((m) => [m.id, (m.body as { answers: Answers }).answers])), [messages]);
  const visible = messages.filter((m) => !isAnswer(m));
  const waiting = visible.filter(isWaiting);

  const lastSeq = messages.at(-1)?.seq;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
    if (lastSeq) markRead(entry.channel.id, lastSeq);
  }, [lastSeq, entry.channel.id]);

  const answer = (message: Message) => (answers: Answers) =>
    send.mutate({ reply_to: message.id, body: { answers } }, { onError: (err) => toast.error(err.message) });
  const sendEvent = (message: Message) => (blockId: string | null, value: unknown, label?: string) =>
    send.mutate({ reply_to: message.id, body: { event: { block_id: blockId, value: value as never, label } } }, { onError: (err) => toast.error(err.message) });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
          {error && <p className="text-destructive text-sm">{error.message}</p>}
          {!isPending && visible.length === 0 && <p className="text-muted-foreground text-sm">No messages yet.</p>}
          {visible.map((message) =>
            isEvent(message) ? (
              <EventLine key={message.id} message={message} />
            ) : (
              <MessageView
                key={message.id}
                message={message}
                submitted={message.ask?.answer_id ? answersById.get(message.ask.answer_id) : undefined}
                onAnswer={entry.revoked ? undefined : answer(message)}
                onEvent={entry.revoked ? undefined : sendEvent(message)}
              />
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      {waiting.length > 0 && (
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 pb-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => document.getElementById(`msg-${waiting[0]!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <MessageCircleQuestionIcon />
            {waiting.length === 1 ? "Something is waiting for your reply" : `${waiting.length} things are waiting for your reply`}
          </Button>
        </div>
      )}
      {!entry.revoked && <Composer disabled={send.isPending} onSend={(text) => send.mutate({ body: { text } })} />}
    </div>
  );
}

function EventLine({ message }: { message: Message }) {
  const event = !message.enc && "event" in message.body ? message.body.event : undefined;
  return (
    <div className="text-muted-foreground flex items-center justify-end gap-1.5 px-1 text-xs">
      <CornerDownRightIcon className="size-3" />
      <span className="max-w-[70%] truncate">Sent: {event ? eventLabel(event) : ""}</span>
      <span>· {formatTime(message.created_at)}</span>
      {message.state && <StateLabel state={message.state} />}
    </div>
  );
}

function MessageView({
  message,
  submitted,
  onAnswer,
  onEvent,
}: {
  message: Message;
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
        {"blocks" in body && body.blocks?.length ? (
          <MessageBlocks blocks={body.blocks} status={askStatus(message.ask)} submitted={submitted} onSubmit={onAnswer} onEvent={onEvent} />
        ) : null}
      </div>
    );
  })();

  return (
    <div id={`msg-${message.id}`} className={cn("flex flex-col gap-1", fromAgent ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-3",
          fromAgent ? "bg-muted" : "bg-primary text-primary-foreground",
          isWaiting(message) && "ring-primary/30 ring-2",
        )}
      >
        {content}
      </div>
      <span className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
        {formatTime(message.created_at)}
        {message.updated_at && <span>· edited</span>}
        {message.state && <StateLabel state={message.state} />}
      </span>
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
    <span className={cn("flex items-center gap-1", state === "working" && "text-amber-600 dark:text-amber-400", state === "done" && "text-emerald-600 dark:text-emerald-400")}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}
