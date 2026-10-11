import { useState } from "react";
import { ActivityIndicator, ActionSheetIOS, Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import type { FileRef, ServerInfo } from "@rply/schema";
import { api } from "@/lib/api";
import type { StoredChannel } from "@/lib/channels";
import { uploadFile } from "@/lib/files";

type Pending = { key: string; name: string; file?: FileRef };
type Picked = { uri: string; name: string; mime?: string | null };

export function Composer({ entry, disabled, onSend }: { entry: StoredChannel; disabled?: boolean; onSend: (text: string, attachments: FileRef[]) => void }) {
  const { data: info } = useQuery({ queryKey: ["info", entry.server], queryFn: () => api<ServerInfo>(entry.server, "/info"), staleTime: Infinity });
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const uploading = pending.some((p) => !p.file);
  const ready = pending.flatMap((p) => (p.file ? [p.file] : []));
  const canSend = !disabled && !uploading && (text.trim() || ready.length > 0);

  const upload = (picked: Picked[]) => {
    for (const p of picked) {
      const key = `${Date.now()}-${Math.random()}`;
      setPending((x) => [...x, { key, name: p.name }]);
      uploadFile(entry, p)
        .then((file) => setPending((x) => x.map((y) => (y.key === key ? { ...y, file } : y))))
        .catch((err) => {
          Alert.alert(`Couldn't upload ${p.name}`, err.message);
          setPending((x) => x.filter((y) => y.key !== key));
        });
    }
  };

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.9 });
    if (!result.canceled) upload(result.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mime: a.mimeType })));
  };
  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!result.canceled) upload(result.assets.map((a) => ({ uri: a.uri, name: a.name, mime: a.mimeType })));
  };
  const attach = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: ["Photo library", "Files", "Cancel"], cancelButtonIndex: 2 }, (i) =>
        i === 0 ? pickPhotos() : i === 1 ? pickFiles() : undefined,
      );
    } else {
      Alert.alert("Attach", undefined, [
        { text: "Photo library", onPress: pickPhotos },
        { text: "Files", onPress: pickFiles },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), ready);
    setText("");
    setPending([]);
  };

  return (
    <View className="gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
      {pending.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {pending.map((p) => (
            <View key={p.key} className="flex-row items-center gap-1.5 rounded-md bg-neutral-100 py-1 pr-1 pl-2 dark:bg-neutral-800">
              {!p.file && <ActivityIndicator size="small" />}
              <Text numberOfLines={1} className="max-w-40 text-sm text-neutral-900 dark:text-neutral-100">
                {p.name}
              </Text>
              <Pressable hitSlop={8} onPress={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                <Text className="px-1 text-neutral-500">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View className="flex-row items-end gap-2">
        {info?.files.enabled && (
          <Pressable onPress={attach} hitSlop={6} className="rounded-lg px-2 py-2.5">
            <Text className="text-lg text-neutral-500">📎</Text>
          </Pressable>
        )}
        <TextInput
          className="max-h-32 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          multiline
          placeholder="Message the agent…"
          value={text}
          onChangeText={setText}
        />
        <Pressable onPress={submit} disabled={!canSend} className={`rounded-lg bg-neutral-900 px-4 py-2.5 dark:bg-neutral-100 ${!canSend ? "opacity-40" : ""}`}>
          <Text className="font-medium text-white dark:text-neutral-900">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
