import { PlusIcon } from "lucide-react";
import { Link } from "wouter";
import type { Message } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { useReadSeqs, type StoredChannel } from "@/lib/channels";
import { askStatus, formatTime, isAnswer, preview } from "@/lib/format";
import { useAllMessages } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AddChannelDialog } from "./AddChannelDialog";
import { OwnerButton } from "./OwnerButton";

export function ChannelList({ channels, activeId }: { channels: StoredChannel[]; activeId?: string }) {
  const results = useAllMessages(channels);
  const readSeqs = useReadSeqs();
  const rows = channels
    .map((entry, i) => {
      const messages: Message[] = results[i]?.data ?? [];
      const last = messages.filter((m) => !isAnswer(m)).at(-1);
      const unread = messages.filter((m) => m.sender === "agent" && m.seq > (readSeqs[entry.channel.id] ?? 0)).length;
      const waiting = messages.some((m) => askStatus(m.ask) === "open");
      return { entry, last, unread, waiting };
    })
    .sort((a, b) => (b.last?.created_at ?? b.entry.channel.created_at) - (a.last?.created_at ?? a.entry.channel.created_at));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">rply</span>
        <div className="flex items-center gap-1">
          <OwnerButton />
          <AddChannelDialog
            trigger={
              <Button size="icon" variant="ghost" aria-label="Add channel">
                <PlusIcon />
              </Button>
            }
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {rows.map(({ entry, last, unread, waiting }) => (
          <Link
            key={entry.channel.id}
            href={`/c/${entry.channel.id}`}
            className={cn("hover:bg-muted flex flex-col gap-0.5 border-b px-4 py-3", activeId === entry.channel.id && "bg-muted")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{entry.channel.name}</span>
              {last && <span className="text-muted-foreground shrink-0 text-xs">{formatTime(last.created_at)}</span>}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-sm">
                {entry.revoked ? "Access revoked" : last ? preview(last) : "No messages yet"}
              </span>
              {waiting && <span className="text-primary shrink-0 text-xs font-medium">Needs reply</span>}
              {unread > 0 && (
                <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-1.5 text-xs font-medium tabular-nums">{unread}</span>
              )}
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
}
