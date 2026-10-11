import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { removeChannel, type StoredChannel } from "@/lib/channels";
import { PinnedMessages } from "./PinnedMessages";
import { Thread } from "./Thread";

export function ChannelView({ entry }: { entry: StoredChannel }) {
  const [, navigate] = useLocation();

  const remove = () => {
    if (!confirm(`Remove "${entry.channel.name}" from this browser?`)) return;
    removeChannel(entry.channel.id);
    navigate("/");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 px-4">
        <Button asChild size="icon" variant="ghost" className="md:hidden" aria-label="Back">
          <Link href="/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h2 className="truncate text-sm font-medium">{entry.channel.name}</h2>
        {entry.revoked && <Badge variant="destructive">Revoked</Badge>}
        <div className="ml-auto" />
        {!entry.admin && (
          <Button size="icon" variant="ghost" onClick={remove} aria-label="Remove channel">
            <Trash2Icon />
          </Button>
        )}
      </header>
      <PinnedMessages entry={entry} />
      <Thread entry={entry} />
    </div>
  );
}
