import type { StoredChannel } from "@/lib/channels";
import { formatTime } from "@/lib/format";
import { useStatus } from "@/lib/queries";
import { MessageBlocks } from "./blocks/MessageBlocks";

export function StatusView({ entry }: { entry: StoredChannel }) {
  const { data: status, isPending } = useStatus(entry);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!isPending && !status && <p className="text-muted-foreground text-sm">This agent hasn't published a status page yet.</p>}
        {status?.enc && <p className="text-muted-foreground italic">Encrypted status page</p>}
        {status && !status.enc && "blocks" in status.body && (
          <>
            <MessageBlocks blocks={status.body.blocks ?? []} status={null} />
            <p className="text-muted-foreground text-xs">Updated {formatTime(status.updated_at ?? status.created_at)}</p>
          </>
        )}
      </div>
    </div>
  );
}
