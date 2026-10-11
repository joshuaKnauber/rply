import { useId, useState } from "react";
import {
  answeredCount,
  collectAnswers,
  inputDefaults,
  inputsOf,
  isInput,
  isKnownBlock,
  missingInputs,
  submitsOnTap,
  type Answers,
  type AskStatus,
  type Block,
} from "@rply/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatValue } from "@/lib/format";
import { BlockView, type OnEvent } from "./BlockView";
import { HtmlBlock } from "./HtmlBlock";
import { ChoiceInput, ConfirmInput, NumberInput, TextInput, ToggleInput } from "./Inputs";

type Props = {
  blocks: Block[];
  status: AskStatus | null;
  submitted?: Answers;
  onSubmit?: (answers: Answers) => void;
  onEvent?: OnEvent;
};

export function MessageBlocks({ blocks, status, submitted, onSubmit, onEvent }: Props) {
  const inputs = inputsOf(blocks);
  const uid = useId();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const open = status === "open" && Boolean(onSubmit);
  const autoSubmit = submitsOnTap(inputs);
  const defaults = status === "expired" ? inputDefaults(inputs) : {};
  const shown: Record<string, unknown> = submitted ?? (open ? values : defaults);

  const missing = missingInputs(inputs, values);

  const change = (id: string, value: unknown) => {
    if (!open) return;
    if (autoSubmit) return onSubmit!({ [id]: value } as Answers);
    setValues((v) => ({ ...v, [id]: value }));
  };

  let questionNumber = 0;

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        if (!isInput(block)) return <BlockView key={block.id ?? i} block={block} onEvent={onEvent} />;
        questionNumber++;
        const input = renderInput(block, `${uid}-${block.id}`, shown[block.id!], !open, (v) => change(block.id!, v), onEvent);
        return inputs.length > 1 ? (
          <div key={block.id} className="flex gap-3 border-l-2 pl-3">
            <span className="text-muted-foreground text-sm tabular-nums">{questionNumber}.</span>
            <div className="min-w-0 flex-1">{input}</div>
          </div>
        ) : (
          <div key={block.id}>{input}</div>
        );
      })}

      {open && !autoSubmit && (
        <div className="flex items-center gap-3">
          <Button disabled={missing.length > 0} onClick={() => onSubmit!(collectAnswers(inputs, values))}>
            {inputs.length > 1 ? "Send answers" : "Send"}
          </Button>
          {inputs.length > 1 && (
            <span className="text-muted-foreground text-xs">
              {answeredCount(inputs, values)} of {inputs.length} answered
            </span>
          )}
        </div>
      )}
      <StatusLine status={status} usedDefaults={status === "expired" && Object.keys(defaults).length > 0} />
    </div>
  );
}

function StatusLine({ status, usedDefaults }: { status: AskStatus | null; usedDefaults: boolean }) {
  if (status === "answered") return <span className="text-muted-foreground text-xs">Answered</span>;
  if (status === "expired") return <Badge variant="secondary">{usedDefaults ? "Expired, default answer used" : "Expired"}</Badge>;
  if (status === "cancelled") return <Badge variant="secondary">Cancelled by the agent</Badge>;
  return null;
}

function renderInput(block: Block, domId: string, value: unknown, disabled: boolean, onChange: (value: unknown) => void, onEvent?: OnEvent) {
  if (!isKnownBlock(block)) return null;
  const props = { domId, value, disabled, onChange };
  switch (block.type) {
    case "choice":
      return <ChoiceInput block={block} {...props} />;
    case "text_input":
      return <TextInput block={block} {...props} />;
    case "number_input":
      return <NumberInput block={block} {...props} />;
    case "toggle":
      return <ToggleInput block={block} {...props} />;
    case "confirm":
      return <ConfirmInput block={block} {...props} />;
    case "html":
      return (
        <div className="flex flex-col gap-1">
          <HtmlBlock block={block} onReply={disabled ? undefined : onChange} onSend={onEvent && ((v, label) => onEvent(block.id ?? null, v, label))} />
          {value !== undefined && <span className="text-sm">Answer: {formatValue(value)}</span>}
        </div>
      );
    default:
      return null;
  }
}
