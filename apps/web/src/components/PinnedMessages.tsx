import { useState } from "react";
import { ChevronDownIcon, PinOffIcon } from "lucide-react";
import { isApp, type Message, type ChannelEntry } from "@rply/schema";
import { MessageContext } from "@/lib/channel-context";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";
import { usePins, useSendMessage, useUnpin } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Markdown } from "./blocks/Markdown";
import { Button } from "@/components/ui/button";
import { MessageBlocks } from "./blocks/MessageBlocks";

export function PinnedMessages({ entry }: { entry: ChannelEntry }) {
  const { data: pins = [] } = usePins(entry);
  const send = useSendMessage(entry);
  const unpin = useUnpin(entry);
  const onEvent = (message: Message) => (blockId: string | null, value: unknown, label?: string) =>
    send.mutate(
      { reply_to: message.id, body: { event: { block_id: blockId, value: value as never, label } } },
      { onSuccess: () => toast.success("Sent to the agent"), onError: (err) => toast.error(err.message) },
    );

  return pins.filter((m) => !isApp(m)).map((message) => (
    <Pinned
      key={message.id}
      message={message}
      onEvent={onEvent(message)}
      onUnpin={() => unpin.mutate(message.id, { onError: (err) => toast.error(err.message) })}
    />
  ));
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
    <section className="group flex flex-col gap-3 py-5">
      <div className="flex items-center gap-1">
        <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm">
          <span className="truncate">{title}</span>
          <ChevronDownIcon className={cn("size-3.5 opacity-0 transition group-hover:opacity-100", !open && "-rotate-90 opacity-100")} />
          <span className="ml-auto text-xs tabular-nums">{formatTime(message.updated_at ?? message.created_at)}</span>
        </button>
        {onUnpin && (
          <Button size="icon-xs" variant="ghost" className="text-muted-foreground -mr-1 opacity-0 group-hover:opacity-100" onClick={onUnpin} aria-label="Unpin" title="Unpin (moves it into the chat)">
            <PinOffIcon />
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          {!body && <p className="text-muted-foreground text-sm italic">Encrypted</p>}
          {body?.text && <Markdown text={body.text} />}
          {body && "blocks" in body && body.blocks?.length ? (
            <MessageContext.Provider value={message}>
              <MessageBlocks blocks={body.blocks} status={null} onEvent={onEvent} />
            </MessageContext.Provider>
          ) : null}
        </div>
      )}
    </section>
  );
}
