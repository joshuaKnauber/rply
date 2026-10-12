import { useState } from "react";
import { DownloadIcon, ImageOffIcon, LoaderIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, INLINE_IMAGE_TYPES, INLINE_VIDEO_TYPES, type FileRef } from "@rply/schema";
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
  if (isPending) return <div className="bg-muted h-40 w-64 animate-pulse rounded-lg" />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-fit cursor-zoom-in" aria-label={`Preview ${name ?? "image"}`}>
        <img src={url} alt={name ?? "Image"} className="max-h-80 max-w-full rounded-lg border" />
      </button>
      <ImagePreview url={url} name={name ?? "image"} open={open} onOpenChange={setOpen} />
    </>
  );
}

function VideoView(props: FileProps) {
  const entry = useChannelEntry();
  const [play, setPlay] = useState(false);
  const { data: url, isFetching, error } = useFileUrl(entry, props.fileId, play);
  const [failed, setFailed] = useState(false);
  if (error || failed) return <FileView {...props} mime={undefined} />;
  if (!url) {
    return (
      <button
        type="button"
        onClick={() => setPlay(true)}
        disabled={isFetching}
        aria-label={`Play ${props.name}`}
        className="bg-muted hover:bg-muted/70 relative flex aspect-video w-full max-w-md items-center justify-center rounded-lg border transition-colors"
      >
        {isFetching ? <LoaderIcon className="text-muted-foreground size-8 animate-spin" /> : <PlayIcon className="text-muted-foreground size-10" />}
        <span className="text-muted-foreground absolute inset-x-3 bottom-2 flex gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-left">{props.name}</span>
          {props.size !== undefined && <span className="tabular-nums">{formatBytes(props.size)}</span>}
        </span>
      </button>
    );
  }
  return (
    <video
      src={url}
      controls
      autoPlay={play}
      playsInline
      aria-label={props.name}
      onError={() => setFailed(true)}
      className="max-h-96 w-fit max-w-full rounded-lg border bg-black"
    />
  );
}

export function FileView(props: FileProps) {
  if (props.mime && INLINE_VIDEO_TYPES.includes(props.mime)) return <VideoView {...props} />;
  return (
    <div className="max-w-md overflow-hidden rounded-lg border">
      <FileRow {...props} />
    </div>
  );
}

type FileProps = { fileId: string; name: string; mime?: string; size?: number };

function FileRow({ fileId, name, size }: FileProps) {
  const entry = useChannelEntry();
  const download = () => entry && downloadFile(entry, fileId, name).catch((err) => toast.error(err.message));
  const ext = name.includes(".") ? name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE";
  return (
    <button type="button" onClick={download} className="group hover:bg-muted/60 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors" aria-label={`Download ${name}`}>
      <span className="bg-muted text-muted-foreground flex h-6 min-w-9 shrink-0 items-center justify-center rounded px-1 font-mono text-xs font-medium">{ext}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      {size !== undefined && <span className="text-muted-foreground shrink-0 text-xs tabular-nums group-hover:hidden">{formatBytes(size)}</span>}
      <DownloadIcon className="text-muted-foreground hidden size-4 shrink-0 group-hover:block" />
    </button>
  );
}

export function AttachmentList({ attachments }: { attachments: FileRef[] }) {
  const images = attachments.filter((a) => INLINE_IMAGE_TYPES.includes(a.mime));
  const videos = attachments.filter((a) => INLINE_VIDEO_TYPES.includes(a.mime));
  const files = attachments.filter((a) => !INLINE_IMAGE_TYPES.includes(a.mime) && !INLINE_VIDEO_TYPES.includes(a.mime));
  return (
    <div className="flex flex-col gap-2">
      {images.map((a) => (
        <ImageView key={a.file_id} fileId={a.file_id} name={a.name} />
      ))}
      {videos.map((a) => (
        <VideoView key={a.file_id} fileId={a.file_id} name={a.name} mime={a.mime} size={a.size} />
      ))}
      {files.length > 0 && (
        <div className="flex max-w-md flex-col divide-y overflow-hidden rounded-lg border">
          {files.map((a) => (
            <FileRow key={a.file_id} fileId={a.file_id} name={a.name} mime={a.mime} size={a.size} />
          ))}
        </div>
      )}
    </div>
  );
}
