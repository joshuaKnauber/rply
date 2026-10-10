import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { removeChannel, type StoredChannel } from "@/lib/channels";
import { StatusView } from "./StatusView";
import { Thread } from "./Thread";

export function ChannelView({ entry }: { entry: StoredChannel }) {
  const [, navigate] = useLocation();

  const remove = () => {
    if (!confirm(`Remove "${entry.channel.name}" from this browser?`)) return;
    removeChannel(entry.channel.id);
    navigate("/");
  };

  return (
    <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col gap-0">
      <header className="flex items-center gap-2 border-b px-4 py-2">
        <Button asChild size="icon" variant="ghost" className="md:hidden" aria-label="Back">
          <Link href="/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h2 className="truncate font-semibold">{entry.channel.name}</h2>
        {entry.revoked && <Badge variant="destructive">Revoked</Badge>}
        <TabsList className="ml-auto">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>
        <Button size="icon" variant="ghost" onClick={remove} aria-label="Remove channel">
          <Trash2Icon />
        </Button>
      </header>
      <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
        <Thread entry={entry} />
      </TabsContent>
      <TabsContent value="status" className="flex min-h-0 flex-1 flex-col">
        <StatusView entry={entry} />
      </TabsContent>
    </Tabs>
  );
}
