import { useState } from "react";
import { Alert, Image, Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import { formatBytes, INLINE_IMAGE_TYPES, type FileRef } from "@rply/schema";
import { useChannelEntry } from "@/lib/channel-context";
import { fileHeaders, fileUrl, openFile } from "@/lib/files";

export function ImageView({ fileId, name }: { fileId: string; name?: string }) {
  const entry = useChannelEntry();
  const [ratio, setRatio] = useState(4 / 3);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  if (!entry || failed) return <Text className="text-sm text-neutral-500">Image no longer available</Text>;
  const source = { uri: fileUrl(entry, fileId), headers: fileHeaders(entry) };
  const share = () => openFile(entry, fileId, name ?? `${fileId}.png`).catch((err) => Alert.alert("Couldn't share", err.message));

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Image
          source={source}
          accessibilityLabel={name ?? "Image"}
          resizeMode="contain"
          onLoad={(e) => e.nativeEvent.source.width && setRatio(e.nativeEvent.source.width / e.nativeEvent.source.height)}
          onError={() => setFailed(true)}
          style={{ width: "100%", aspectRatio: ratio, maxHeight: 360, borderRadius: 8 }}
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)" }}>
          <View className="flex-row items-center gap-4 px-4 py-3">
            <Text numberOfLines={1} className="flex-1 font-medium text-white">
              {name ?? "Image"}
            </Text>
            <Pressable hitSlop={8} onPress={share}>
              <Text className="text-white">Share</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setOpen(false)}>
              <Text className="text-lg text-white">✕</Text>
            </Pressable>
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
            <Image source={source} resizeMode="contain" style={{ flex: 1 }} accessibilityLabel={name ?? "Image"} />
          </Pressable>
        </SafeAreaView>
      </Modal>
    </>
  );
}

export function FileView({ fileId, name, mime, size }: { fileId: string; name: string; mime?: string; size?: number }) {
  const entry = useChannelEntry();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (!entry) return;
    setBusy(true);
    try {
      await openFile(entry, fileId, name);
    } catch (err) {
      Alert.alert("Couldn't open the file", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={open} className="flex-row items-center gap-3 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
      <Text className="text-lg">📄</Text>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-medium text-neutral-900 dark:text-neutral-100">
          {name}
        </Text>
        <Text numberOfLines={1} className="text-xs text-neutral-500">
          {busy ? "Downloading…" : [size !== undefined && formatBytes(size), mime].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

export function AttachmentList({ attachments }: { attachments: FileRef[] }) {
  return (
    <View className="gap-2">
      {attachments.map((a) =>
        INLINE_IMAGE_TYPES.includes(a.mime) ? (
          <ImageView key={a.file_id} fileId={a.file_id} name={a.name} />
        ) : (
          <FileView key={a.file_id} fileId={a.file_id} name={a.name} mime={a.mime} size={a.size} />
        ),
      )}
    </View>
  );
}

