import { isKnownBlock, type Block } from "@rply/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileView, ImageView } from "./Attachments";
import { HtmlBlock } from "./HtmlBlock";
import { Markdown } from "./Markdown";
import { SecretBlock } from "./SecretBlock";

export type OnEvent = (blockId: string | null, value: unknown, label?: string) => void;

export function BlockView({ block, onEvent }: { block: Block; onEvent?: OnEvent }) {
  if (!isKnownBlock(block)) return <Badge variant="outline">Update rply to see this "{block.type}" block</Badge>;

  switch (block.type) {
    case "markdown":
      return <Markdown text={block.text} />;
    case "heading":
      return <h3 className="text-base font-semibold">{block.text}</h3>;
    case "progress": {
      const max = block.max ?? 100;
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-4 text-sm">
            <span>{block.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {block.value} / {max}
            </span>
          </div>
          <Progress value={(block.value / max) * 100} />
        </div>
      );
    }
    case "keyvalue":
      return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          {block.items.map((item) => (
            <div key={item.key} className="contents">
              <dt className="text-muted-foreground">{item.key}</dt>
              <dd className="font-medium wrap-anywhere">{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <Table>
          <TableHeader>
            <TableRow>
              {block.columns.map((column, i) => (
                <TableHead key={i}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    case "code":
      return (
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
          <code>{block.code}</code>
        </pre>
      );
    case "link":
      return /^https?:\/\//.test(block.url) ? (
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-4 wrap-anywhere">
          {block.label ?? block.url}
        </a>
      ) : null;
    case "image":
      return <ImageView fileId={block.file_id} name={block.name ?? block.alt} />;
    case "file":
      return <FileView fileId={block.file_id} name={block.name} mime={block.mime} size={block.size} />;
    case "secret":
      return <SecretBlock block={block} />;
    case "html":
      return <HtmlBlock block={block} onSend={onEvent && ((value, label) => onEvent(block.id ?? null, value, label))} />;
    default:
      return null;
  }
}
