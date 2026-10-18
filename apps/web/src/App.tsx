import { useEffect } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { AddChannelPage } from "@/components/AddChannelPage";
import { AgentCreatorHost } from "@/components/AgentCreator";
import { AuthPage, ResetPasswordPage } from "@/components/AuthPage";
import { ChannelList } from "@/components/ChannelList";
import { ChannelView } from "@/components/ChannelView";
import { ClaimPage } from "@/components/ClaimPage";
import { SettingsPage } from "@/components/SettingsPage";
import { useSession } from "@/lib/auth";
import { useChannels } from "@/lib/channels";
import { registerServiceWorker, usePushSync } from "@/lib/push";
import { useSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

export function App() {
  const session = useSession();
  return (
    <Switch>
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route>
        {session.isPending ? null : !session.data ? (
          <AuthPage />
        ) : (
          <Switch>
            <Route path="/claim" component={ClaimPage} />
            <Route>
              <Inbox userId={session.data.user.id} />
            </Route>
          </Switch>
        )}
      </Route>
    </Switch>
  );
}

function Inbox({ userId }: { userId: string }) {
  const { data: channels = [], isPending } = useChannels();
  const [, chat] = useRoute("/c/:id");
  const [, app] = useRoute("/c/:id/a/:key");
  const active = channels.find((c) => c.id === (chat ?? app)?.id);
  const [adding] = useRoute("/add");
  const [settings] = useRoute("/settings");
  const showMain = Boolean(active) || adding || settings || channels.length === 0;
  const [, navigate] = useLocation();
  useSync(active?.id);
  usePushSync(userId);

  useEffect(() => {
    registerServiceWorker();
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "rply:open") navigate(new URL(e.data.url).pathname);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  if (isPending) return null;

  return (
    <div className="flex h-full">
      <aside className={cn("bg-sidebar w-full md:flex md:w-72 md:shrink-0 md:border-r", showMain ? "hidden" : "flex")}>
        <ChannelList channels={channels} activeId={active?.id} activeApp={app?.key} adding={adding} settings={settings} />
      </aside>
      <main className={cn("min-w-0 flex-1 flex-col", showMain ? "flex" : "hidden md:flex")}>
        {active ? (
          <ChannelView key={active.id} entry={active} appKey={app?.key} />
        ) : settings ? (
          <SettingsPage />
        ) : adding || channels.length === 0 ? (
          <AddChannelPage first={channels.length === 0} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-muted-foreground text-sm">Select a channel</p>
          </div>
        )}
      </main>
      <AgentCreatorHost />
    </div>
  );
}
