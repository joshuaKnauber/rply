import { useState } from "react";
import { CheckIcon } from "lucide-react";
import type { BlockOf } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputProps<T> = { block: T; domId: string; value: unknown; disabled: boolean; onChange: (value: unknown) => void };

export function ChoiceInput({ block, value, disabled, onChange }: InputProps<BlockOf<"choice">>) {
  const values = block.options.map((o) => o.value ?? o.label);
  const selected = new Set(Array.isArray(value) ? (value as string[]) : value === undefined ? [] : [value as string]);
  const otherValue = [...selected].find((v) => !values.includes(v));
  const [other, setOther] = useState(otherValue ?? "");
  const detailed = block.options.some((o) => o.description);

  const pick = (v: string) => {
    if (!block.multi) return onChange(v);
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  };

  return (
    <div className="flex flex-col gap-2">
      {block.label && <p className="text-sm font-medium">{block.label}</p>}
      <div className={cn("gap-2", detailed ? "flex flex-col" : "flex flex-wrap")}>
        {block.options.map((option, i) => {
          const v = values[i]!;
          const isSelected = selected.has(v);
          return (
            <Button
              key={v}
              size={detailed ? "default" : "sm"}
              variant={isSelected ? (option.danger ? "destructive" : "default") : "outline"}
              disabled={disabled}
              onClick={() => pick(v)}
              className={cn(detailed && "h-auto justify-start py-2 text-left whitespace-normal", option.danger && !isSelected && "text-destructive", isSelected && "disabled:opacity-100")}
            >
              {block.multi && isSelected && <CheckIcon />}
              <span className="flex flex-col items-start">
                <span>{option.label}</span>
                {option.description && <span className="text-xs font-normal opacity-70">{option.description}</span>}
              </span>
            </Button>
          );
        })}
      </div>
      {block.other && (
        <div className="flex gap-2">
          <Input placeholder="Other…" disabled={disabled} value={other} onChange={(e) => setOther(e.target.value)} />
          {!disabled && (
            <Button size="sm" variant="outline" disabled={!other.trim()} onClick={() => pick(other.trim())}>
              Use
            </Button>
          )}
        </div>
      )}
      {otherValue && disabled && <p className="text-sm">Other: {otherValue}</p>}
    </div>
  );
}

export function TextInput({ block, domId, value, disabled, onChange }: InputProps<BlockOf<"text_input">>) {
  const props = { id: domId, disabled, placeholder: block.placeholder, value: String(value ?? ""), onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
  return (
    <div className="flex flex-col gap-1.5">
      {block.label && <Label htmlFor={domId}>{block.label}</Label>}
      {block.multiline ? <Textarea {...props} /> : <Input {...props} />}
    </div>
  );
}

export function NumberInput({ block, domId, value, disabled, onChange }: InputProps<BlockOf<"number_input">>) {
  return (
    <div className="flex flex-col gap-1.5">
      {block.label && <Label htmlFor={domId}>{block.label}</Label>}
      <Input
        id={domId}
        type="number"
        min={block.min}
        max={block.max}
        disabled={disabled}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)}
      />
    </div>
  );
}

export function ToggleInput({ block, domId, value, disabled, onChange }: InputProps<BlockOf<"toggle">>) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={domId} disabled={disabled} checked={Boolean(value)} onCheckedChange={onChange} />
      <Label htmlFor={domId}>{block.label}</Label>
    </div>
  );
}

export function ConfirmInput({ block, value, disabled, onChange }: InputProps<BlockOf<"confirm">>) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {block.description && <p className="text-muted-foreground text-sm">{block.description}</p>}
      <Button
        variant={block.danger ? "destructive" : "default"}
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(value === true && "disabled:opacity-100")}
      >
        {value === true && <CheckIcon />}
        {block.label}
      </Button>
    </div>
  );
}
