import { useState } from "react";
import { Pressable, Switch, Text, TextInput as RNTextInput, View } from "react-native";
import type { BlockOf } from "@rply/schema";
import { Button } from "./Button";

type InputProps<T> = { block: T; value: unknown; disabled: boolean; onChange: (value: unknown) => void };

const text = "text-neutral-900 dark:text-neutral-100";
const field = `rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 ${text}`;

function Label({ children }: { children?: string }) {
  return children ? <Text className={`font-medium ${text}`}>{children}</Text> : null;
}

export function ChoiceInput({ block, value, disabled, onChange }: InputProps<BlockOf<"choice">>) {
  const values = block.options.map((o) => o.value ?? o.label);
  const selected = new Set(Array.isArray(value) ? (value as string[]) : value === undefined ? [] : [value as string]);
  const otherValue = [...selected].find((v) => !values.includes(v));
  const [other, setOther] = useState(otherValue ?? "");

  const pick = (v: string) => {
    if (!block.multi) return onChange(v);
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  };

  return (
    <View className="gap-2">
      <Label>{block.label}</Label>
      <View className="gap-2">
        {block.options.map((option, i) => {
          const v = values[i]!;
          const isSelected = selected.has(v);
          return (
            <Pressable
              key={v}
              disabled={disabled}
              onPress={() => pick(v)}
              className={`rounded-lg border px-3 py-2.5 ${
                isSelected
                  ? option.danger
                    ? "border-red-600 bg-red-600"
                    : "border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100"
                  : "border-neutral-300 dark:border-neutral-700"
              } ${disabled && !isSelected ? "opacity-40" : ""}`}
            >
              <Text
                className={`font-medium ${isSelected ? (option.danger ? "text-white" : "text-white dark:text-neutral-900") : option.danger ? "text-red-600" : text}`}
              >
                {block.multi && isSelected ? "✓ " : ""}
                {option.label}
              </Text>
              {option.description && (
                <Text className={`text-xs ${isSelected ? (option.danger ? "text-white" : "text-white dark:text-neutral-900") : "text-neutral-500"}`}>
                  {option.description}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {block.other && !disabled && (
        <View className="flex-row items-center gap-2">
          <RNTextInput className={`flex-1 ${field}`} placeholder="Other…" value={other} onChangeText={setOther} />
          <Button label="Use" variant="outline" disabled={!other.trim()} onPress={() => pick(other.trim())} />
        </View>
      )}
      {otherValue && disabled && <Text className={text}>Other: {otherValue}</Text>}
    </View>
  );
}

export function TextInput({ block, value, disabled, onChange }: InputProps<BlockOf<"text_input">>) {
  return (
    <View className="gap-1.5">
      <Label>{block.label}</Label>
      <RNTextInput
        className={`${field} ${block.multiline ? "min-h-20" : ""}`}
        multiline={block.multiline}
        editable={!disabled}
        placeholder={block.placeholder}
        value={String(value ?? "")}
        onChangeText={onChange}
      />
    </View>
  );
}

export function NumberInput({ block, value, disabled, onChange }: InputProps<BlockOf<"number_input">>) {
  return (
    <View className="gap-1.5">
      <Label>{block.label}</Label>
      <RNTextInput
        className={field}
        keyboardType="numeric"
        editable={!disabled}
        value={value === undefined ? "" : String(value)}
        onChangeText={(v) => onChange(v === "" || Number.isNaN(Number(v)) ? undefined : Number(v))}
      />
    </View>
  );
}

export function ToggleInput({ block, value, disabled, onChange }: InputProps<BlockOf<"toggle">>) {
  return (
    <View className="flex-row items-center gap-3">
      <Switch disabled={disabled} value={Boolean(value)} onValueChange={onChange} />
      <Text className={`flex-1 ${text}`}>{block.label}</Text>
    </View>
  );
}

export function ConfirmInput({ block, value, disabled, onChange }: InputProps<BlockOf<"confirm">>) {
  return (
    <View className="items-start gap-1.5">
      {block.description && <Text className="text-neutral-500">{block.description}</Text>}
      <Pressable
        disabled={disabled}
        onPress={() => onChange(true)}
        className={`rounded-lg px-4 py-2.5 ${block.danger ? "bg-red-600" : "bg-neutral-900 dark:bg-neutral-100"} ${disabled && value !== true ? "opacity-40" : ""}`}
      >
        <Text className={`font-medium ${block.danger ? "text-white" : "text-white dark:text-neutral-900"}`}>
          {value === true ? "✓ " : ""}
          {block.label}
        </Text>
      </Pressable>
    </View>
  );
}
