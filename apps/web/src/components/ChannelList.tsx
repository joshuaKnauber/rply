import { PlusIcon } from "lucide-react";
import { Link } from "wouter";
import type { Message } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { useReadSeqs, type StoredChannel } from "@/lib/channels";
import { isWaiting } from "@rply/schema";
import { formatTime, isAnswer, preview } from "@/lib/format";
import { useAllMessages } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { NotificationsButton } from "./NotificationsButton";
import { OwnerButton } from "./OwnerButton";
import { Bird } from "./Bird";

export function ChannelList({ channels, activeId, adding }: { channels: StoredChannel[]; activeId?: string; adding?: boolean }) {
  const results = useAllMessages(channels);
  const readSeqs = useReadSeqs();
  const rows = channels
    .map((entry, i) => {
      const messages: Message[] = results[i]?.data ?? [];
      const last = messages.filter((m) => !isAnswer(m)).at(-1);
      const unread = messages.filter((m) => m.sender === "agent" && m.seq > (readSeqs[entry.channel.id] ?? 0)).length;
      const waiting = messages.some(isWaiting);
      return { entry, last, unread, waiting };
    })
    .sort((a, b) => (b.last?.created_at ?? b.entry.channel.created_at) - (a.last?.created_at ?? a.entry.channel.created_at));

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:pr-2">
        <span className="flex items-center gap-2 font-semibold">
          <Bird className="w-5" />
          rply
        </span>
        <div className="flex items-center gap-1">
          <NotificationsButton channels={channels} />
          <OwnerButton />
          <Button asChild size="icon" variant="ghost" className={cn(adding && "bg-foreground/6")} aria-label="Add channel">
            <Link href="/add">
              <PlusIcon />
            </Link>
          </Button>
        </div>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto pb-2">
        <span className="text-muted-foreground px-4 pt-4 pb-2 text-sm">{channels.length} {channels.length === 1 ? "channel" : "channels"}</span>
        {rows.map(({ entry, last, unread, waiting }) => (
          <Link
            key={entry.channel.id}
            href={`/c/${entry.channel.id}`}
            className={cn(
              "hover:bg-foreground/4 flex flex-col gap-0.5 px-4 py-2.5",
              activeId === entry.channel.id && "bg-foreground/6 hover:bg-foreground/6",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{entry.channel.name}</span>
              {last && <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatTime(last.created_at)}</span>}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-sm">
                {entry.revoked ? "Access revoked" : last ? preview(last) : "No messages yet"}
              </span>
              {waiting && <span className="bg-attention size-1.5 shrink-0 rounded-full" title="Needs reply" />}
              {unread > 0 && (
                <span className="text-foreground shrink-0 text-xs font-medium tabular-nums">{unread}</span>
              )}
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
}
