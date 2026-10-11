import { useEffect } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { ChannelList } from "@/components/ChannelList";
import { ChannelView } from "@/components/ChannelView";
import { PairPage } from "@/components/PairPage";
import { AddChannelPage } from "@/components/AddChannelPage";
import { useChannels } from "@/lib/channels";
import { registerServiceWorker, usePushSync } from "@/lib/push";
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
  const [adding] = useRoute("/add");
  const showMain = Boolean(active) || adding || channels.length === 0;
  const [, navigate] = useLocation();
  useSync(channels, active?.channel.id);
  usePushSync(channels);

  useEffect(() => {
    registerServiceWorker();
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "rply:open") navigate(new URL(e.data.url).pathname);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  return (
    <div className="flex h-full">
      <aside className={cn("bg-sidebar w-full md:flex md:w-72 md:shrink-0 md:border-r", showMain ? "hidden" : "flex")}>
        <ChannelList channels={channels} activeId={active?.channel.id} adding={adding} />
      </aside>
      <main
        className={cn(
          "min-w-0 flex-1 flex-col",
          showMain ? "flex" : "hidden md:flex",
        )}
      >
        {active ? (
          <ChannelView key={active.channel.id} entry={active} />
        ) : adding || channels.length === 0 ? (
          <AddChannelPage first={channels.length === 0} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-muted-foreground text-sm">Select a channel</p>
          </div>
        )}
      </main>
    </div>
  );
}
