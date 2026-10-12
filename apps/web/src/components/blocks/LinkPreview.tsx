import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LinkIcon } from "lucide-react";
import { shortUrl, type LinkPreview } from "@rply/schema";
import { api } from "@/lib/api";
import { auth } from "@/lib/channels";
import { useChannelEntry } from "@/lib/channel-context";

function usePreview(url: string) {
  const entry = useChannelEntry();
  return useQuery({
    queryKey: ["unfurl", url],
    queryFn: () => api<LinkPreview>(`/unfurl?url=${encodeURIComponent(url)}`, auth(entry!)),
    enabled: Boolean(entry),
    staleTime: Infinity,
    retry: false,
  }).data;
}

export function LinkChip({ url }: { url: string }) {
  const preview = usePreview(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className="bg-muted hover:bg-foreground/8 inline-flex max-w-full items-center gap-1.5 rounded-md py-px pr-2 pl-1.5 align-bottom text-sm font-medium no-underline!"
    >
      <Favicon src={preview?.icon} />
      <span className="truncate">{preview?.title ?? shortUrl(url)}</span>
    </a>
  );
}

export function LabeledLink({ url, children }: { url: string; children: ReactNode }) {
  const preview = usePreview(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
      {preview?.icon && <InlineFavicon src={preview.icon} />}
      {children}
    </a>
  );
}

export function LinkCard({ url }: { url: string }) {
  const preview = usePreview(url);
  const [imageFailed, setImageFailed] = useState(false);
  if (!preview?.title) return <LinkChip url={url} />;
  const site = preview.site ?? new URL(url).host.replace(/^www\./, "");

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className="hover:bg-muted/60 flex max-w-lg gap-3 rounded-lg border p-3 no-underline! transition-colors"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Favicon src={preview.icon} />
          <span className="truncate">{site}</span>
        </div>
        <span className="line-clamp-2 text-sm font-medium">{preview.title}</span>
        {preview.description && <span className="text-muted-foreground truncate text-sm">{preview.description}</span>}
      </div>
      {preview.image && !imageFailed && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="bg-muted size-16 shrink-0 self-center rounded-md object-cover"
        />
      )}
    </a>
  );
}

function InlineFavicon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="mr-1 inline-block size-3.5 rounded-sm align-[-2px]" />;
}

function Favicon({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <LinkIcon className="text-muted-foreground size-3.5 shrink-0" />;
  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-3.5 shrink-0 rounded-sm" />;
}
