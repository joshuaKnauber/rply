import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { embedDocument, type BlockOf, type EmbedTheme } from "@rply/schema";

type Props = { block: BlockOf<"html">; onReply?: (value: unknown) => void; onSend?: (value: unknown, label?: string) => void };

const currentTheme = (): EmbedTheme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

export function HtmlBlock({ block, onReply, onSend }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(block.height ?? 150);
  const theme: EmbedTheme = useTheme().resolvedTheme === "dark" ? "dark" : "light";
  const [initialTheme] = useState(currentTheme);

  useLayoutEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.rply === "resize" && !block.height) setHeight(Math.min(Math.max(Number(e.data.height) || 0, 40), 2000));
      if (e.data.rply === "reply") onReply?.(e.data.value);
      if (e.data.rply === "send") onSend?.(e.data.value, typeof e.data.label === "string" ? e.data.label : undefined);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [block.height, onReply, onSend]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ rply: "theme", theme }, "*");
  }, [theme]);

  return (
    <div className="bg-background overflow-hidden rounded-lg border dark:bg-input/20">
      {block.label && <div className="text-muted-foreground border-b px-3 py-2 text-sm">{block.label}</div>}
      <div className="p-3">
        <iframe
          ref={frame}
          title={block.label ?? "Embedded content"}
          sandbox="allow-scripts"
          srcDoc={embedDocument(block, "parent", initialTheme)}
          style={{ height, colorScheme: theme }}
          className="block w-full border-0 bg-transparent"
        />
      </div>
    </div>
  );
}
