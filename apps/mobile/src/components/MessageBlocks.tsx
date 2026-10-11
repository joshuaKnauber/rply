import { useState } from "react";
import { Text, View } from "react-native";
import {
  answeredCount,
  collectAnswers,
  formatValue,
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
import { BlockView } from "./BlockView";
import { Button } from "./Button";
import { HtmlBlock } from "./HtmlBlock";
import { ChoiceInput, ConfirmInput, NumberInput, TextInput, ToggleInput } from "./Inputs";

type Props = { blocks: Block[]; status: AskStatus | null; submitted?: Answers; onSubmit?: (answers: Answers) => void };

export function MessageBlocks({ blocks, status, submitted, onSubmit }: Props) {
  const inputs = inputsOf(blocks);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const open = status === "open" && Boolean(onSubmit);
  const autoSubmit = submitsOnTap(inputs);
  const defaults = status === "expired" ? inputDefaults(inputs) : {};
  const shown: Record<string, unknown> = submitted ?? (open ? values : defaults);

  const change = (id: string, value: unknown) => {
    if (!open) return;
    if (autoSubmit) return onSubmit!({ [id]: value } as Answers);
    setValues((v) => ({ ...v, [id]: value }));
  };

  let number = 0;

  return (
    <View className="gap-3">
      {blocks.map((block, i) => {
        if (!isInput(block)) return <BlockView key={block.id ?? i} block={block} />;
        number++;
        const input = renderInput(block, shown[block.id!], !open, (v) => change(block.id!, v));
        return inputs.length > 1 ? (
          <View key={block.id} className="flex-row gap-3 border-l-2 border-neutral-200 pl-3 dark:border-neutral-800">
            <Text className="text-neutral-500">{number}.</Text>
            <View className="flex-1">{input}</View>
          </View>
        ) : (
          <View key={block.id}>{input}</View>
        );
      })}
      {open && !autoSubmit && (
        <View className="gap-1.5">
          <Button
            label={inputs.length > 1 ? "Send answers" : "Send"}
            disabled={missingInputs(inputs, values).length > 0}
            onPress={() => onSubmit!(collectAnswers(inputs, values))}
          />
          {inputs.length > 1 && (
            <Text className="text-center text-xs text-neutral-500">
              {answeredCount(inputs, values)} of {inputs.length} answered
            </Text>
          )}
        </View>
      )}
      <StatusLine status={status} usedDefaults={status === "expired" && Object.keys(defaults).length > 0} />
    </View>
  );
}

function StatusLine({ status, usedDefaults }: { status: AskStatus | null; usedDefaults: boolean }) {
  const label =
    status === "answered"
      ? "Answered"
      : status === "expired"
        ? usedDefaults
          ? "Expired, default answer used"
          : "Expired"
        : status === "cancelled"
          ? "Cancelled by the agent"
          : null;
  return label ? <Text className="text-xs text-neutral-500">{label}</Text> : null;
}

function renderInput(block: Block, value: unknown, disabled: boolean, onChange: (value: unknown) => void) {
  if (!isKnownBlock(block)) return null;
  const props = { value, disabled, onChange };
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
        <View className="gap-1">
          <HtmlBlock block={block} onReply={disabled ? undefined : onChange} />
          {value !== undefined && <Text className="text-neutral-900 dark:text-neutral-100">Answer: {formatValue(value)}</Text>}
        </View>
      );
    default:
      return null;
  }
}
