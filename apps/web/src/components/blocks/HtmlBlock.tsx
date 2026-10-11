import { useEffect, useRef, useState } from "react";
import type { BlockOf } from "@rply/schema";

const bridge = `<script>
window.rply = {
  reply: (value) => parent.postMessage({ rply: "reply", value }, "*"),
  resize: (height) => parent.postMessage({ rply: "resize", height }, "*"),
};
addEventListener("load", () => {
  new ResizeObserver(() => rply.resize(document.documentElement.scrollHeight)).observe(document.documentElement);
});
</script>
<style>html,body{margin:0;font-family:system-ui,sans-serif;color-scheme:light dark}</style>`;

type Props = { block: BlockOf<"html">; onReply?: (value: unknown) => void };

export function HtmlBlock({ block, onReply }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(block.height ?? 150);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.rply === "resize" && !block.height) setHeight(Math.min(Math.max(Number(e.data.height) || 0, 40), 2000));
      if (e.data.rply === "reply") onReply?.(e.data.value);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [block.height, onReply]);

  return (
    <div className="flex flex-col gap-1">
      <iframe
        ref={frame}
        title={block.label ?? "Embedded content"}
        sandbox="allow-scripts"
        srcDoc={bridge + block.html}
        style={{ height }}
        className="w-full rounded-md border bg-white"
      />
      <span className="text-muted-foreground text-xs">{block.label ?? "Embedded content from the agent"}</span>
    </div>
  );
}
