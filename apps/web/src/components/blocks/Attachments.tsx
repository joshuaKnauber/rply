import { useState } from "react";
import { DownloadIcon, FileIcon, ImageOffIcon } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, INLINE_IMAGE_TYPES, type FileRef } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { useChannelEntry } from "@/lib/channel-context";
import { downloadFile, useFileUrl } from "@/lib/files";
import { ImagePreview } from "./ImagePreview";

export function ImageView({ fileId, name }: { fileId: string; name?: string }) {
  const entry = useChannelEntry();
  const { data: url, isPending, error } = useFileUrl(entry, fileId);
  const [open, setOpen] = useState(false);
  if (error) {
    return (
      <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm">
        <ImageOffIcon className="size-4" /> {error.message}
      </div>
    );
  }
  if (isPending) return <div className="bg-muted h-40 w-64 animate-pulse rounded-md" />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-fit cursor-zoom-in" aria-label={`Preview ${name ?? "image"}`}>
        <img src={url} alt={name ?? "Image"} className="max-h-80 max-w-full rounded-md" />
      </button>
      <ImagePreview url={url} name={name ?? "image"} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function FileView({ fileId, name, mime, size }: { fileId: string; name: string; mime?: string; size?: number }) {
  const entry = useChannelEntry();
  const download = () => entry && downloadFile(entry, fileId, name).catch((err) => toast.error(err.message));
  return (
    <div className="bg-muted text-foreground flex max-w-sm items-center gap-3 rounded-md px-3 py-2">
      <FileIcon className="text-muted-foreground size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {(size !== undefined || mime) && (
          <p className="text-muted-foreground truncate text-xs">{[size !== undefined && formatBytes(size), mime].filter(Boolean).join(" · ")}</p>
        )}
      </div>
      <Button size="icon" variant="ghost" className="size-8" onClick={download} aria-label={`Download ${name}`}>
        <DownloadIcon />
      </Button>
    </div>
  );
}

export function AttachmentList({ attachments }: { attachments: FileRef[] }) {
  return (
    <div className="flex flex-col gap-2">
      {attachments.map((a) =>
        INLINE_IMAGE_TYPES.includes(a.mime) ? (
          <ImageView key={a.file_id} fileId={a.file_id} name={a.name} />
        ) : (
          <FileView key={a.file_id} fileId={a.file_id} name={a.name} mime={a.mime} size={a.size} />
        ),
      )}
    </div>
  );
}
