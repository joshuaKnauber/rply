import { useState, type ReactNode } from "react";
import { Image, Linking, Pressable, Text, View, type TextStyle } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { shortUrl, type LinkPreview } from "@rply/schema";
import { api } from "@/lib/api";
import { auth } from "@/lib/channels";
import { useChannelEntry } from "@/lib/channel-context";

function usePreview(url: string) {
  const entry = useChannelEntry();
  return useQuery({
    queryKey: ["unfurl", url],
    queryFn: () => api<LinkPreview>(entry!.server, `/unfurl?url=${encodeURIComponent(url)}`, auth(entry!)),
    enabled: Boolean(entry),
    staleTime: Infinity,
    retry: false,
  }).data;
}

export function LinkText({ url, style }: { url: string; style?: TextStyle }) {
  const preview = usePreview(url);
  return (
    <Text style={style} accessibilityRole="link" onPress={() => Linking.openURL(url)}>
      {preview?.title ?? shortUrl(url)}
    </Text>
  );
}

export function LabeledLinkText({ url, style, children }: { url: string; style?: TextStyle; children: ReactNode }) {
  const preview = usePreview(url);
  const [failed, setFailed] = useState(false);
  return (
    <Text style={style} accessibilityRole="link" onPress={() => Linking.openURL(url)}>
      {preview?.icon && !failed && <Image source={{ uri: preview.icon }} onError={() => setFailed(true)} style={{ width: 14, height: 14, borderRadius: 3 }} />}
      {preview?.icon && !failed ? " " : ""}
      {children}
    </Text>
  );
}

export function LinkCard({ url }: { url: string }) {
  const preview = usePreview(url);
  const [imageFailed, setImageFailed] = useState(false);
  if (!preview?.title) {
    return (
      <Text className="font-medium text-neutral-900 underline dark:text-neutral-100" onPress={() => Linking.openURL(url)}>
        {shortUrl(url)}
      </Text>
    );
  }
  const site = preview.site ?? new URL(url).host.replace(/^www\./, "");

  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      className="flex-row gap-3 rounded-xl border border-neutral-200 p-3 active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900"
    >
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          {preview.icon && <Favicon uri={preview.icon} />}
          <Text numberOfLines={1} className="flex-1 text-xs text-neutral-500">
            {site}
          </Text>
        </View>
        <Text numberOfLines={2} className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {preview.title}
        </Text>
        {preview.description && (
          <Text numberOfLines={1} className="text-sm text-neutral-500">
            {preview.description}
          </Text>
        )}
      </View>
      {preview.image && !imageFailed && (
        <Image source={{ uri: preview.image }} onError={() => setImageFailed(true)} className="size-16 self-center rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      )}
    </Pressable>
  );
}

function Favicon({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <Image source={{ uri }} onError={() => setFailed(true)} className="size-3.5 rounded-sm" />;
}
