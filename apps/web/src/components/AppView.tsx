import { toast } from "sonner";
import { appTitle, type BlockOf, type Message } from "@rply/schema";
import type { StoredChannel } from "@/lib/channels";
import { MessageContext } from "@/lib/channel-context";
import { useSendMessage } from "@/lib/queries";
import { HtmlBlock } from "./blocks/HtmlBlock";
import { Markdown } from "./blocks/Markdown";
import { MessageBlocks } from "./blocks/MessageBlocks";

export function AppView({ entry, app }: { entry: StoredChannel; app: Message }) {
  const send = useSendMessage(entry);
  const onEvent = entry.revoked
    ? undefined
    : (blockId: string | null, value: unknown, label?: string) =>
        send.mutate(
          { reply_to: app.id, body: { event: { block_id: blockId, value: value as never, label } } },
          { onSuccess: () => toast.success("Sent to the agent"), onError: (err) => toast.error(err.message) },
        );

  const body = app.enc ? null : app.body;
  const blocks = body && "blocks" in body ? (body.blocks ?? []) : [];
  const only = blocks.length === 1 && !body?.text && blocks[0]!.type === "html" ? (blocks[0] as BlockOf<"html">) : undefined;

  return (
    <MessageContext.Provider value={app}>
      {only ? (
        <div className="min-h-0 flex-1">
          <HtmlBlock key={app.id} block={only} fill onSend={onEvent && ((value, label) => onEvent(only.id ?? null, value, label))} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {!body && <p className="text-muted-foreground text-sm italic">Encrypted</p>}
            {body?.text && <Markdown text={body.text} />}
            {blocks.length > 0 && <MessageBlocks blocks={blocks} status={null} onEvent={onEvent} />}
            {body && !body.text && blocks.length === 0 && <p className="text-muted-foreground text-sm">{appTitle(app)} is empty.</p>}
          </div>
        </div>
      )}
    </MessageContext.Provider>
  );
}
