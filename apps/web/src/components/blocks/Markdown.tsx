import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isBareLink, splitUrlLines } from "@rply/schema";
import { LinkCard, LinkChip } from "./LinkPreview";

type HastNode = { value?: string; children?: HastNode[] };

const textOf = (node: HastNode): string => node.value ?? (node.children ?? []).map(textOf).join("");

export function Markdown({ text }: { text: string }) {
  const parts = useMemo(() => splitUrlLines(text), [text]);
  return (
    <div className="markdown">
      {parts.map((part, i) =>
        part.type === "url" ? (
          <LinkCard key={i} url={part.url} />
        ) : (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, href, children, ...props }) =>
                href && node && isBareLink(href, textOf(node as HastNode)) ? (
                  <LinkChip url={href} />
                ) : (
                  <a {...props} href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              table: (props) => (
                <div className="overflow-x-auto">
                  <table {...props} />
                </div>
              ),
            }}
          >
            {part.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}
