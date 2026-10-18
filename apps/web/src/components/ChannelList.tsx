import { AppWindowIcon, ArrowUpRightIcon, BookOpenIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { Link } from "wouter";
import type { AgentParticipant, Message, ChannelEntry } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { appTitle, birdLook, isApp } from "@rply/schema";
import { formatTime, isAnswer, preview } from "@/lib/format";
import { useAllAgents, useAllMessages, useAllPins } from "@/lib/queries";
import { openCustomizer } from "@/lib/customize";
import { cn } from "@/lib/utils";
import { AgentAvatar, AvatarPlaceholder, useAgentMoods } from "./AgentAvatar";
import { NotificationsButton } from "./NotificationsButton";
import { Logo } from "./Logo";

type Props = { channels: ChannelEntry[]; activeId?: string; activeApp?: string; adding?: boolean; settings?: boolean };

export function ChannelList({ channels, activeId, activeApp, adding, settings }: Props) {
  const results = useAllMessages(channels);
  const pins = useAllPins(channels);
  const agents = useAllAgents(channels);
  const rows = channels
    .map((entry, i) => {
      const messages: Message[] = results[i]?.data ?? [];
      const last = messages.filter((m) => !isAnswer(m)).at(-1);
      const unread = messages.filter((m) => m.sender === "agent" && m.seq > entry.read_seq).length;
      const apps = (pins[i]?.data ?? []).filter(isApp);
      return { entry, messages, agents: agents[i]?.data ?? [], last, unread, apps };
    })
    .sort((a, b) => (b.last?.created_at ?? b.entry.created_at) - (a.last?.created_at ?? a.entry.created_at));

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:pr-2">
        <Logo />
        <div className="flex items-center gap-1">
          <NotificationsButton />
          <Button asChild size="icon" variant="ghost" className={cn(adding && "bg-foreground/6")} aria-label="Add channel">
            <Link href="/add">
              <PlusIcon />
            </Link>
          </Button>
        </div>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto pb-2 [--avatar-ring:var(--sidebar)]">
        <span className="text-muted-foreground px-4 pt-4 pb-2 text-sm">{channels.length} {channels.length === 1 ? "channel" : "channels"}</span>
        {rows.map(({ entry, messages, agents, last, unread, apps }) => (
          <div key={entry.id} className="flex flex-col">
            <Link
              href={`/c/${entry.id}`}
              className={cn(
                "hover:bg-foreground/4 flex items-center gap-3 px-4 py-2.5",
                activeId === entry.id && !activeApp && "bg-foreground/6 hover:bg-foreground/6",
              )}
            >
              <ChannelAvatar entry={entry} agents={agents} messages={messages} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{entry.name}</span>
                  {last && <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatTime(last.created_at)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate text-sm">
                    {last ? preview(last) : "No messages yet"}
                  </span>
                  {unread > 0 && (
                    <span className="text-foreground shrink-0 text-xs font-medium tabular-nums">{unread}</span>
                  )}
                </div>
              </div>
            </Link>
            {apps.map((app) => (
              <Link
                key={app.id}
                href={`/c/${entry.id}/a/${app.pin}`}
                className={cn(
                  "hover:bg-foreground/4 text-muted-foreground flex items-center gap-2 py-1.5 pr-4 pl-15 text-sm",
                  activeId === entry.id && activeApp === app.pin && "bg-foreground/6 hover:bg-foreground/6 text-foreground",
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

const MOOD_ORDER = { waiting: 0, working: 1, idle: 2, offline: 3 };

// one bird per channel, or two when several agents share it: whoever needs you first
function ChannelAvatar({ entry, agents, messages }: { entry: ChannelEntry; agents: AgentParticipant[]; messages: Message[] }) {
  const moods = useAgentMoods(agents, messages);
  const lastSeq = new Map<string, number>();
  for (const m of messages) if (m.agent) lastSeq.set(m.agent.id, m.seq);
  const shown = [...agents]
    .sort((a, b) => MOOD_ORDER[moods.get(a.id)!] - MOOD_ORDER[moods.get(b.id)!] || (lastSeq.get(b.id) ?? 0) - (lastSeq.get(a.id) ?? 0))
    .slice(0, 2);
  const avatar = (agent: AgentParticipant, size: number, className?: string) => (
    <AgentAvatar
      key={agent.id}
      look={birdLook(agent.id, agents)}
      mood={moods.get(agent.id)!}
      size={size}
      group={entry.id}
      chirp={lastSeq.get(agent.id)}
      className={className}
      title={`Customize ${agent.label ?? "agent"}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openCustomizer(entry, agent.id);
      }}
    />
  );
  if (shown.length === 0) return <AvatarPlaceholder size={32} />;
  if (shown.length === 1) return avatar(shown[0]!, 32);
  return (
    <span className="relative size-8 shrink-0">
      {avatar(shown[0]!, 22, "absolute top-0 left-0")}
      {avatar(shown[1]!, 22, "absolute right-0 bottom-0")}
    </span>
  );
}
