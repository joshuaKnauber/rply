import { Linking, Pressable, Text, View } from "react-native";
import { isKnownBlock, type Block } from "@rply/schema";
import { FileView, ImageView } from "./Attachments";
import { HtmlBlock } from "./HtmlBlock";
import { Markdown } from "./Markdown";
import { SecretBlock } from "./SecretBlock";

const text = "text-neutral-900 dark:text-neutral-100";
const muted = "text-neutral-500 dark:text-neutral-400";

export type OnEvent = (blockId: string | null, value: unknown, label?: string) => void;

export function BlockView({ block, onEvent }: { block: Block; onEvent?: OnEvent }) {
  if (!isKnownBlock(block)) return <Text className={muted}>Update rply to see this "{block.type}" block</Text>;

  switch (block.type) {
    case "markdown":
      return <Markdown text={block.text} />;
    case "heading":
      return <Text className={`text-base font-semibold ${text}`}>{block.text}</Text>;
    case "progress": {
      const max = block.max ?? 100;
      return (
        <View className="gap-1.5">
          <View className="flex-row justify-between gap-4">
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
