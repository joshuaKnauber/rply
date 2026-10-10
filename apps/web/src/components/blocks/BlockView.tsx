import type { Block } from "@rply/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormBlock } from "./FormBlock";
import { Markdown } from "./Markdown";

type Props = {
  block: Block;
  answer?: unknown;
  onAction?: (elementId: string, value: unknown) => void;
};

export function BlockView({ block, answer, onAction }: Props) {
  switch (block.type) {
    case "markdown":
      return <Markdown text={block.text} />;
    case "heading":
      return <h3 className="text-base font-semibold">{block.text}</h3>;
    case "buttons":
      return (
        <div className="flex flex-wrap gap-2">
          {block.options.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={answer === option.value ? "default" : "outline"}
              className={answer === option.value ? "disabled:opacity-100" : undefined}
              disabled={answer !== undefined || !onAction}
              onClick={() => onAction?.(block.id, option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      );
    case "form":
      return <FormBlock block={block} answer={answer} onSubmit={onAction && ((values) => onAction(block.id, values))} />;
    case "progress": {
      const max = block.max ?? 100;
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
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
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {block.items.map((item) => (
            <div key={item.key} className="contents">
              <dt className="text-muted-foreground">{item.key}</dt>
              <dd className="font-medium">{item.value}</dd>
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
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-4">
          {block.label ?? block.url}
        </a>
      ) : null;
    default:
      return <Badge variant="outline">Unsupported block</Badge>;
  }
}
