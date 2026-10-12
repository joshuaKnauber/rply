import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import type { BlockOf, SecretStatus } from "@rply/schema";
import { secretStatus } from "@rply/schema/helpers";
import { useChannelEntry } from "@/lib/channel-context";
import { declineSecret, KeyChangedError, provideSecret } from "@/lib/secrets";
import { Button } from "./Button";

const text = "text-neutral-900 dark:text-neutral-100";

const statusLabel: Record<Exclude<SecretStatus, "open">, string> = {
  provided: "Provided, waiting for the agent to write it",
  delivered: "✓ Written by the agent",
  declined: "Declined",
  cancelled: "Cancelled by the agent",
  expired: "Expired",
};

export function SecretBlock({ block }: { block: BlockOf<"secret"> }) {
  const entry = useChannelEntry();
  const status = secretStatus(block);
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const open = status === "open" && entry;

  const provide = useMutation({
    mutationFn: (acceptNewKey: boolean) => provideSecret(entry!, block, value, acceptNewKey),
    onSuccess: () => setValue(""),
    onError: (err) => {
      if (!(err instanceof KeyChangedError)) return Alert.alert("Couldn't send", err.message);
      Alert.alert(
        "This request uses a new encryption key",
        `You trusted ${err.previous} before, this one is ${err.current}. That's expected if an agent joined or was set up again; otherwise someone may be trying to intercept the secret.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Trust and send", style: "destructive", onPress: () => provide.mutate(true) },
        ],
      );
    },
  });
  const decline = useMutation({ mutationFn: () => declineSecret(entry!, block.id) });

  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Text className={`font-semibold ${text}`}>🔑 Secret requested: {block.name}</Text>
        <Text className="text-sm text-neutral-500">
          {block.mode === "env" ? "Written as a line in " : "Written as the whole file "}
          {block.target}
        </Text>
        {block.reason && <Text className={text}>{block.reason}</Text>}
      </View>
      {open ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <TextInput
              className={`flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono dark:border-neutral-700 ${text} ${block.mode === "file" ? "min-h-24" : ""}`}
              secureTextEntry={!visible && block.mode === "env"}
              multiline={block.mode === "file"}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={block.mode === "file" ? "Paste the file contents" : `Value for ${block.name}`}
              value={value}
              onChangeText={setValue}
            />
            {block.mode === "env" && (
              <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8}>
                <Text className="text-sm text-neutral-500">{visible ? "Hide" : "Show"}</Text>
              </Pressable>
            )}
          </View>
          <Button label={provide.isPending ? "Encrypting…" : "Send securely"} disabled={!value || provide.isPending} onPress={() => provide.mutate(false)} />
          <Button label="Decline" variant="outline" disabled={decline.isPending} onPress={() => decline.mutate()} />
          <Text className="text-xs text-neutral-500">Encrypted on this device for the agent's key. The server can't read it.</Text>
        </View>
      ) : (
        <Text className="text-sm text-neutral-500">{status === "open" ? "Waiting" : statusLabel[status]}</Text>
      )}
    </View>
  );
}
