import { useState } from "react";
import { Linking, Pressable, Switch, Text, TextInput, View } from "react-native";
import type { Block } from "@rply/schema";
import { Button } from "./Button";

type Props = { block: Block; answer?: unknown; onAction?: (elementId: string, value: unknown) => void };

const text = "text-neutral-900 dark:text-neutral-100";
const muted = "text-neutral-500 dark:text-neutral-400";

export function BlockView({ block, answer, onAction }: Props) {
  switch (block.type) {
    case "markdown":
      return <Text className={`text-[15px] leading-6 ${text}`}>{block.text}</Text>;
    case "heading":
      return <Text className={`text-base font-semibold ${text}`}>{block.text}</Text>;
    case "buttons":
      return (
        <View className="flex-row flex-wrap gap-2">
          {block.options.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant="outline"
              selected={answer === option.value}
              disabled={answer !== undefined || !onAction}
              onPress={() => onAction?.(block.id, option.value)}
            />
          ))}
        </View>
      );
    case "form":
      return <FormBlock block={block} answer={answer} onSubmit={onAction && ((values) => onAction(block.id, values))} />;
    case "progress": {
      const max = block.max ?? 100;
      return (
        <View className="gap-1.5">
          <View className="flex-row justify-between">
            <Text className={text}>{block.label}</Text>
            <Text className={muted}>
              {block.value} / {max}
            </Text>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <View className="h-full bg-neutral-900 dark:bg-neutral-100" style={{ width: `${Math.min(100, (block.value / max) * 100)}%` }} />
          </View>
        </View>
      );
    }
    case "keyvalue":
      return (
        <View className="gap-1">
          {block.items.map((item) => (
            <View key={item.key} className="flex-row gap-4">
              <Text className={`w-28 ${muted}`}>{item.key}</Text>
              <Text className={`flex-1 font-medium ${text}`}>{item.value}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View className="rounded-lg border border-neutral-200 dark:border-neutral-800">
          {[block.columns, ...block.rows].map((row, i) => (
            <View key={i} className={`flex-row ${i > 0 ? "border-t border-neutral-200 dark:border-neutral-800" : ""}`}>
              {row.map((cell, j) => (
                <Text key={j} className={`flex-1 px-3 py-2 ${i === 0 ? "font-medium" : ""} ${text}`}>
                  {String(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "code":
      return (
        <View className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
          <Text className={`font-mono text-xs ${text}`}>{block.code}</Text>
        </View>
      );
    case "link":
      return /^https?:\/\//.test(block.url) ? (
        <Pressable onPress={() => Linking.openURL(block.url)}>
          <Text className={`font-medium underline ${text}`}>{block.label ?? block.url}</Text>
        </Pressable>
      ) : null;
    default:
      return <Text className={muted}>Unsupported block</Text>;
  }
}

type FormBlockType = Extract<Block, { type: "form" }>;
type Values = Record<string, string | number | boolean>;

function FormBlock({ block, answer, onSubmit }: { block: FormBlockType; answer?: unknown; onSubmit?: (values: Values) => void }) {
  const [values, setValues] = useState<Values>(() => (answer as Values) ?? {});
  const set = (name: string, value: Values[string]) => setValues((v) => ({ ...v, [name]: value }));
  const disabled = answer !== undefined || !onSubmit;
  const missing = block.fields.some((f) => "required" in f && f.required && (values[f.name] === undefined || values[f.name] === ""));
  const input = `rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 ${text}`;

  return (
    <View className="gap-3">
      {block.fields.map((field) => (
        <View key={field.name} className="gap-1.5">
          {field.type !== "toggle" && <Text className={`font-medium ${text}`}>{field.label}</Text>}
          {(field.type === "text" || field.type === "textarea") && (
            <TextInput
              className={`${input} ${field.type === "textarea" ? "min-h-20" : ""}`}
              multiline={field.type === "textarea"}
              editable={!disabled}
              placeholder={field.placeholder}
              value={String(values[field.name] ?? "")}
              onChangeText={(v) => set(field.name, v)}
            />
          )}
          {field.type === "number" && (
            <TextInput
              className={input}
              keyboardType="numeric"
              editable={!disabled}
              value={values[field.name] === undefined ? "" : String(values[field.name])}
              onChangeText={(v) => set(field.name, Number(v))}
            />
          )}
          {field.type === "select" && (
            <View className="flex-row flex-wrap gap-2">
              {field.options.map((option) => (
                <Button
                  key={option}
                  label={option}
                  variant="outline"
                  selected={values[field.name] === option}
                  disabled={disabled}
                  onPress={() => set(field.name, option)}
                />
              ))}
            </View>
          )}
          {field.type === "toggle" && (
            <View className="flex-row items-center gap-3">
              <Switch disabled={disabled} value={Boolean(values[field.name])} onValueChange={(v) => set(field.name, v)} />
              <Text className={text}>{field.label}</Text>
            </View>
          )}
        </View>
      ))}
      {!disabled && <Button label={block.submit_label ?? "Submit"} disabled={missing} onPress={() => onSubmit?.(values)} />}
    </View>
  );
}
