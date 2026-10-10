import { useState, type FormEvent } from "react";
import type { Block } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type FormBlockType = Extract<Block, { type: "form" }>;
type Values = Record<string, string | number | boolean>;

export function FormBlock({ block, answer, onSubmit }: { block: FormBlockType; answer?: unknown; onSubmit?: (values: Values) => void }) {
  const [values, setValues] = useState<Values>(() => (answer as Values) ?? {});
  const set = (name: string, value: Values[string]) => setValues((v) => ({ ...v, [name]: value }));
  const disabled = answer !== undefined || !onSubmit;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.(values);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {block.fields.map((field) => {
        const id = `${block.id}-${field.name}`;
        const value = values[field.name];
        return (
          <div key={field.name} className={field.type === "toggle" ? "flex items-center gap-2" : "flex flex-col gap-1.5"}>
            {field.type !== "toggle" && <Label htmlFor={id}>{field.label}</Label>}
            {field.type === "text" && (
              <Input id={id} disabled={disabled} required={field.required} placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => set(field.name, e.target.value)} />
            )}
            {field.type === "textarea" && (
              <Textarea id={id} disabled={disabled} required={field.required} placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => set(field.name, e.target.value)} />
            )}
            {field.type === "number" && (
              <Input id={id} type="number" disabled={disabled} required={field.required} value={value === undefined ? "" : String(value)} onChange={(e) => set(field.name, e.target.valueAsNumber)} />
            )}
            {field.type === "select" && (
              <Select disabled={disabled} required={field.required} value={value as string | undefined} onValueChange={(v) => set(field.name, v)}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {field.type === "toggle" && (
              <>
                <Switch id={id} disabled={disabled} checked={Boolean(value)} onCheckedChange={(v) => set(field.name, v)} />
                <Label htmlFor={id}>{field.label}</Label>
              </>
            )}
          </div>
        );
      })}
      {!disabled && (
        <Button type="submit" className="self-start">
          {block.submit_label ?? "Submit"}
        </Button>
      )}
    </form>
  );
}
