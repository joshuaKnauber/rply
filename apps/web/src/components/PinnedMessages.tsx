import { useState } from "react";
import { ChevronDownIcon, PinIcon, PinOffIcon } from "lucide-react";
import type { Message } from "@rply/schema";
import type { StoredChannel } from "@/lib/channels";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";
import { usePins, useSendMessage, useUnpin } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Markdown } from "./blocks/Markdown";
import { Button } from "@/components/ui/button";
import { MessageBlocks } from "./blocks/MessageBlocks";

export function PinnedMessages({ entry }: { entry: StoredChannel }) {
  const { data: pins = [] } = usePins(entry);
  const send = useSendMessage(entry);
  const unpin = useUnpin(entry);
  if (pins.length === 0) return null;
  const onEvent = (message: Message) => (blockId: string | null, value: unknown, label?: string) =>
    send.mutate(
      { reply_to: message.id, body: { event: { block_id: blockId, value: value as never, label } } },
      { onSuccess: () => toast.success("Sent to the agent"), onError: (err) => toast.error(err.message) },
    );

  return (
    <div className="px-4">
      <div className="mx-auto flex max-h-[45vh] max-w-3xl flex-col gap-2 overflow-y-auto py-2">
        {pins.map((message) => (
          <Pinned
            key={message.id}
            message={message}
            onEvent={entry.revoked ? undefined : onEvent(message)}
            onUnpin={entry.revoked ? undefined : () => unpin.mutate(message.id, { onError: (err) => toast.error(err.message) })}
          />
        ))}
      </div>
    </div>
  );
}

function Pinned({
  message,
  onEvent,
  onUnpin,
}: {
  message: Message;
  onEvent?: (blockId: string | null, value: unknown, label?: string) => void;
  onUnpin?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const body = message.enc ? null : message.body;
  const title = (body && "title" in body && body.title) || (message.pin === "status" ? "Status" : message.pin);

  return (
    <div className="bg-muted rounded-lg">
      <div className="flex items-center gap-1 pr-1">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 text-left">
          <PinIcon className="text-muted-foreground size-3.5" />
          <span className="flex-1 truncate text-sm font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{formatTime(message.updated_at ?? message.created_at)}</span>
          <ChevronDownIcon className={cn("text-muted-foreground size-4 transition-transform", !open && "-rotate-90")} />
        </button>
        {onUnpin && (
          <Button size="icon" variant="ghost" className="text-muted-foreground size-7" onClick={onUnpin} aria-label="Unpin" title="Unpin (moves it into the chat)">
            <PinOffIcon />
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {!body && <p className="text-muted-foreground text-sm italic">Encrypted</p>}
          {body?.text && <Markdown text={body.text} />}
          {body && "blocks" in body && body.blocks?.length ? <MessageBlocks blocks={body.blocks} status={null} onEvent={onEvent} /> : null}
        </div>
      )}
    </div>
  );
}
