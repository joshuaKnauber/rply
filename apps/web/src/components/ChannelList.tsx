import { AppWindowIcon, ArrowUpRightIcon, BookOpenIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { Link } from "wouter";
import type { Message } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { useReadSeqs, type StoredChannel } from "@/lib/channels";
import { appTitle, isApp, isWaiting } from "@rply/schema";
import { formatTime, isAnswer, preview } from "@/lib/format";
import { useAllMessages, useAllPins } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { NotificationsButton } from "./NotificationsButton";
import { OwnerButton } from "./OwnerButton";
import { Logo } from "./Logo";

type Props = { channels: StoredChannel[]; activeId?: string; activeApp?: string; adding?: boolean; settings?: boolean };

export function ChannelList({ channels, activeId, activeApp, adding, settings }: Props) {
  const results = useAllMessages(channels);
  const pins = useAllPins(channels);
  const readSeqs = useReadSeqs();
  const rows = channels
    .map((entry, i) => {
      const messages: Message[] = results[i]?.data ?? [];
      const last = messages.filter((m) => !isAnswer(m)).at(-1);
      const unread = messages.filter((m) => m.sender === "agent" && m.seq > (readSeqs[entry.channel.id] ?? 0)).length;
      const waiting = messages.some(isWaiting);
      const apps = (pins[i]?.data ?? []).filter(isApp);
      return { entry, last, unread, waiting, apps };
    })
    .sort((a, b) => (b.last?.created_at ?? b.entry.channel.created_at) - (a.last?.created_at ?? a.entry.channel.created_at));

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:pr-2">
        <Logo />
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
        {rows.map(({ entry, last, unread, waiting, apps }) => (
          <div key={entry.channel.id} className="flex flex-col">
            <Link
              href={`/c/${entry.channel.id}`}
              className={cn(
                "hover:bg-foreground/4 flex flex-col gap-0.5 px-4 py-2.5",
                activeId === entry.channel.id && !activeApp && "bg-foreground/6 hover:bg-foreground/6",
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
            {apps.map((app) => (
              <Link
                key={app.id}
                href={`/c/${entry.channel.id}/a/${app.pin}`}
                className={cn(
                  "hover:bg-foreground/4 text-muted-foreground flex items-center gap-2 py-1.5 pr-4 pl-6 text-sm",
                  activeId === entry.channel.id && activeApp === app.pin && "bg-foreground/6 hover:bg-foreground/6 text-foreground",
                )}
              >
                <AppWindowIcon className="size-4 shrink-0" />
                <span className="truncate">{appTitle(app)}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex shrink-0 flex-col gap-0.5 border-t p-2">
        <a
          href="https://rply.sh/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-foreground/4 hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
        >
          <BookOpenIcon className="size-4" />
          Documentation
          <ArrowUpRightIcon className="ml-auto size-3.5" />
        </a>
        <Link
          href="/settings"
          className={cn("text-muted-foreground hover:bg-foreground/4 hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", settings && "bg-foreground/6 text-foreground")}
        >
          <SettingsIcon className="size-4" />
          Settings
        </Link>
      </div>
    </div>
  );
}
