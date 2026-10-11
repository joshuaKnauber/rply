import { ArrowLeftIcon, BotIcon, CalendarIcon, EllipsisIcon, LockIcon, LockOpenIcon, MonitorIcon, PanelRightIcon, SmartphoneIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { removeChannel, type StoredChannel } from "@/lib/channels";
import { ChannelContext } from "@/lib/channel-context";
import { cn } from "@/lib/utils";
import { formatAgo } from "@/lib/format";
import { useAgents, useDeleteChannel, useDevices, usePins, useRemoveApp, useRevoke } from "@/lib/queries";
import { toast } from "sonner";
import { appTitle, isApp, type Participant } from "@rply/schema";
import { AddAgentDialog } from "./AddAgentDialog";
import { AppView } from "./AppView";
import { LinkDeviceDialog } from "./LinkDeviceDialog";
import { confirmDialog } from "./ConfirmDialog";
import { PinnedMessages } from "./PinnedMessages";
import { Thread, WaitingIndicator } from "./Thread";

export function ChannelView({ entry, appKey }: { entry: StoredChannel; appKey?: string }) {
  const [, navigate] = useLocation();
  const { data: pins = [] } = usePins(entry);
  const app = appKey ? pins.find((m) => isApp(m) && m.pin === appKey) : undefined;
  const removeApp = useRemoveApp(entry);
  const deleteChannel = useDeleteChannel(entry);

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Remove "${entry.channel.name}" from this browser?`,
      description: "The channel stays on the server. You can pair this browser again with a new code.",
      action: "Remove",
      destructive: true,
    });
    if (!ok) return;
    removeChannel(entry.channel.id);
    navigate("/");
  };

  const confirmDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete "${entry.channel.name}"?`,
      description: "This deletes the channel with all its messages, files and apps from the server. Its agents and paired devices lose access. This can't be undone.",
      action: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteChannel.mutate(undefined, { onSuccess: () => navigate("/"), onError: (err) => toast.error(err.message) });
  };

  const confirmRemoveApp = async () => {
    if (!app) return;
    const ok = await confirmDialog({
      title: `Remove "${appTitle(app)}"?`,
      description: "It's deleted for every device. The agent can add it again.",
      action: "Remove",
      destructive: true,
    });
    if (!ok) return;
    removeApp.mutate(app.pin!, { onSuccess: () => navigate(`/c/${entry.channel.id}`), onError: (err) => toast.error(err.message) });
  };

  return (
    <ChannelContext.Provider value={entry}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
          <Button asChild size="icon" variant="ghost" className="-ml-3 md:hidden" aria-label="Back">
            <Link href="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="flex min-w-0 items-baseline gap-1.5 font-medium tracking-normal">
            {app ? (
              <>
                <Link href={`/c/${entry.channel.id}`} className="text-muted-foreground hover:text-foreground truncate">
                  {entry.channel.name}
                </Link>
                <span className="text-muted-foreground">/</span>
                <span className="truncate">{appTitle(app)}</span>
              </>
            ) : (
              <span className="truncate">{entry.channel.name}</span>
            )}
          </h1>
          {entry.revoked && <Badge variant="destructive">Revoked</Badge>}
          <WaitingIndicator entry={entry} />
          {app && !entry.revoked && (
            <div className="-mr-2 ml-auto flex items-center gap-1">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-muted-foreground" aria-label="App options">
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto">
                  <DropdownMenuItem variant="destructive" onSelect={confirmRemoveApp}>
                    Remove app
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {!appKey && (
            <div className="-mr-2 ml-auto flex items-center gap-1">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-muted-foreground" aria-label="Channel options">
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto">
                  <DropdownMenuItem variant="destructive" onSelect={entry.admin ? confirmDelete : remove}>
                    {entry.admin ? "Delete channel" : "Remove from this browser"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-muted-foreground lg:hidden" aria-label="Channel details">
                    <PanelRightIcon />
                  </Button>
                </SheetTrigger>
                <SheetContent className="gap-0 overflow-y-auto px-6 pt-4">
                  <SheetTitle className="text-lg">{entry.channel.name}</SheetTitle>
                  <Panel entry={entry} />
                </SheetContent>
              </Sheet>
            </div>
          )}
        </header>
        {appKey ? (
          app ? (
            <AppView entry={entry} app={app} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-muted-foreground text-sm">This app was removed.</p>
            </div>
          )
        ) : (
          <div className="flex min-h-0 flex-1">
            <Thread entry={entry} />
            <aside className="hidden w-80 shrink-0 overflow-y-auto border-l px-6 lg:block">
              <Panel entry={entry} />
            </aside>
          </div>
        )}
      </div>
    </ChannelContext.Provider>
  );
}

function Panel({ entry }: { entry: StoredChannel }) {
  return (
    <div className="flex flex-col divide-y">
      <Details entry={entry} />
      <Participants entry={entry} kind="agents" />
      <Participants entry={entry} kind="devices" />
      <PinnedMessages entry={entry} />
    </div>
  );
}

function Details({ entry }: { entry: StoredChannel }) {
  const created = new Date(entry.channel.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const Lock = entry.channel.e2e ? LockIcon : LockOpenIcon;
  return (
    <ul className="flex flex-col gap-3 py-5">
      <Row icon={CalendarIcon}>Created {created}</Row>
      <Row icon={Lock}>{entry.channel.e2e ? "End-to-end encrypted" : "Not encrypted"}</Row>
    </ul>
  );
}

function Participants({ entry, kind }: { entry: StoredChannel; kind: "agents" | "devices" }) {
  const agents = kind === "agents";
  const { data = [] } = (agents ? useAgents : useDevices)(entry);
  const revoke = useRevoke(entry, kind);

  const canRevoke = (p: Participant) => !p.current && !entry.revoked;
  const confirmRevoke = async (p: Participant) => {
    const ok = await confirmDialog({
      title: `Revoke ${p.label ?? (agents ? "this agent" : "this device")}?`,
      description: `It will no longer be able to use "${entry.channel.name}". ${agents ? "Add it again with a new agent code." : "Pair it again with a new code."}`,
      action: "Revoke",
      destructive: true,
    });
    if (!ok) return;
    revoke.mutate(p.id, { onError: (err) => toast.error(err.message) });
  };

  return (
    <section className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-sm font-normal tracking-normal">{agents ? "Agents" : "Devices"}</h2>
        {!entry.revoked && (agents ? <AddAgentDialog entry={entry} /> : <LinkDeviceDialog entry={entry} />)}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {agents && data.length === 0 && <li className="text-muted-foreground">No agent has joined yet</li>}
        {data.map((p) => (
          <Row key={p.id} icon={agents ? BotIcon : /iPhone|iPad|iOS|Android|Phone/.test(p.label ?? "") ? SmartphoneIcon : MonitorIcon}>
            <span className="truncate">{p.label ?? (agents ? "Agent" : "Unnamed device")}</span>
            <span className="ml-auto flex h-5 shrink-0 items-center">
              <span className={cn("text-muted-foreground text-xs", canRevoke(p) && "group-hover/row:hidden")}>
                {p.current ? "This device" : p.last_seen_at ? formatAgo(p.last_seen_at) : "Never seen"}
              </span>
              {canRevoke(p) && (
                <Button size="xs" variant="ghost" className="text-muted-foreground hidden -mr-2 group-hover/row:flex" onClick={() => confirmRevoke(p)}>
                  Revoke
                </Button>
              )}
            </span>
          </Row>
        ))}
      </ul>
    </section>
  );
}

function Row({ icon: Icon, children }: { icon: typeof CalendarIcon; children: React.ReactNode }) {
  return (
    <li className="group/row flex min-w-0 items-center gap-2.5">
      <Icon className="text-muted-foreground size-4 shrink-0" />
      {children}
    </li>
  );
}
