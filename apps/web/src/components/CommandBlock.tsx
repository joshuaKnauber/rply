import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CommandBlock({ text, wrap }: { text: string; wrap?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bg-muted flex items-start gap-2 rounded-md border py-1 pr-1 pl-3">
      <pre className={cn("min-w-0 flex-1 py-1 font-mono text-sm leading-6", wrap ? "whitespace-pre-wrap" : "overflow-x-auto")}>{text}</pre>
      <Button size="icon-sm" variant="ghost" className="text-muted-foreground" onClick={copy} aria-label="Copy">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
