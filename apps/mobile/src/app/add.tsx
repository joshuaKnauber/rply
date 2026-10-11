import { useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { claimPairing } from "@/lib/channels";

const input = "rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100";

export default function AddChannel() {
  const [pairing, setPairing] = useState("");
  const [server, setServer] = useState("");
  const isLink = /^https?:\/\//.test(pairing.trim());
  const claim = useMutation({
    mutationFn: () => claimPairing(pairing, server),
    onSuccess: (channel) => router.replace(`/channel/${channel.id}`),
  });

  return (
    <ScrollView className="flex-1 bg-white dark:bg-neutral-950" contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
      <Text className="text-neutral-500 dark:text-neutral-400">Paste the pairing link printed by `rply init` or `rply pair`, or enter the code and server.</Text>
      <TextInput className={input} autoCapitalize="none" autoCorrect={false} placeholder="Link or code, e.g. K7QX-M2PD" value={pairing} onChangeText={setPairing} />
      {!isLink && (
        <TextInput
          className={input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="Server, e.g. rply.example.com"
          value={server}
          onChangeText={setServer}
        />
      )}
      {claim.error && <Text className="text-red-600">{claim.error.message}</Text>}
      <Button label={claim.isPending ? "Pairing…" : "Pair"} disabled={!pairing.trim() || claim.isPending} onPress={() => claim.mutate()} />
    </ScrollView>
  );
}
