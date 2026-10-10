import { Route, Switch, useRoute } from "wouter";
import { ChannelList } from "@/components/ChannelList";
import { ChannelView } from "@/components/ChannelView";
import { PairPage } from "@/components/PairPage";
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
      <aside className={cn("w-full border-r md:flex md:w-80 md:shrink-0", active ? "hidden" : "flex")}>
        <div className="w-full">
          <ChannelList channels={channels} activeId={active?.channel.id} />
        </div>
      </aside>
      <main className={cn("min-w-0 flex-1 flex-col", active ? "flex" : "hidden md:flex")}>
        {active ? (
          <ChannelView key={active.channel.id} entry={active} />
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm">
            {channels.length ? "Select a channel" : "No channels yet. Run `npx rply init <server-url>` on your agent, then open the link it prints."}
          </div>
        )}
      </main>
    </div>
  );
}
