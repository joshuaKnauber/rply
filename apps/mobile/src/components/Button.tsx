import { Pressable, Text } from "react-native";

type Props = { label: string; onPress?: () => void; variant?: "primary" | "outline"; disabled?: boolean; selected?: boolean };

export function Button({ label, onPress, variant = "primary", disabled, selected }: Props) {
  const primary = variant === "primary" || selected;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center rounded-lg px-4 py-2.5 ${primary ? "bg-neutral-900 dark:bg-neutral-100" : "border border-neutral-300 dark:border-neutral-700"} ${disabled && !selected ? "opacity-40" : ""}`}
    >
      <Text className={`font-medium ${primary ? "text-white dark:text-neutral-900" : "text-neutral-900 dark:text-neutral-100"}`}>{label}</Text>
    </Pressable>
  );
}
