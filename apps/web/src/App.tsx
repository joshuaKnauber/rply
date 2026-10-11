import { Route, Switch, useRoute } from "wouter";
import { ChannelList } from "@/components/ChannelList";
import { ChannelView } from "@/components/ChannelView";
import { PairPage } from "@/components/PairPage";
import { SetupCommand } from "@/components/SetupCommand";
import { useChannels } from "@/lib/channels";
import { useSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

export function App() {
  return (
    <Switch>
      <Route path="/pair" component={PairPage} />
      <Route component={Inbox} />
    </Switch>
  );
}

function Inbox() {
  const channels = useChannels();
  const [, params] = useRoute("/c/:id");
  const active = channels.find((c) => c.channel.id === params?.id);
  useSync(channels);

  return (
    <div className="flex h-full">
      <aside className={cn("bg-sidebar w-full md:flex md:w-72 md:shrink-0 md:border-r", active ? "hidden" : "flex")}>
        <ChannelList channels={channels} activeId={active?.channel.id} />
      </aside>
      <main
        className={cn(
          "min-w-0 flex-1 flex-col",
          active ? "flex" : "hidden md:flex",
        )}
      >
        {active ? (
          <ChannelView key={active.channel.id} entry={active} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            {channels.length ? (
              <p className="text-muted-foreground text-sm">Select a channel</p>
            ) : (
              <div className="flex w-full max-w-xl flex-col gap-4">
                <h2 className="text-lg font-semibold">Connect your first agent</h2>
                <SetupCommand />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
