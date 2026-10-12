import { useState } from "react";
import { Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { channelsKey, claimChannel, createChannel } from "@/lib/channels";
import { useSessions } from "@/lib/sessions";

const input = "rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100";

const joinPrompt = (server: string, code: string) => `Connect yourself to rply so I can reach you from the rply app:
1. npm install --global @rply/cli
2. rply join ${server} ${code}
3. Run \`rply guide setup\` and follow every step, including the background service and the test message at the end.`;

export default function AddChannel() {
  const sessions = useSessions();
  const queryClient = useQueryClient();
  const [server, setServer] = useState(sessions[0]?.server);
  const session = sessions.find((s) => s.server === server) ?? sessions[0];
  const [name, setName] = useState("");
  const [claimInput, setClaimInput] = useState("");

  const create = useMutation({
    mutationFn: () => createChannel(session!, name.trim()),
    onSuccess: ({ entry }) => queryClient.invalidateQueries({ queryKey: channelsKey(entry.server) }),
  });
  const claim = useMutation({
    mutationFn: () => claimChannel(claimInput, session),
    onSuccess: async (entry) => {
      await queryClient.invalidateQueries({ queryKey: channelsKey(entry.server) });
      router.replace(`/channel/${entry.channel.id}`);
    },
  });

  if (create.data) {
    const prompt = joinPrompt(create.data.entry.server, create.data.code.code);
    return (
      <ScrollView className="flex-1 bg-white dark:bg-neutral-950" contentContainerClassName="gap-4 p-4">
        <Text className="font-semibold text-neutral-900 dark:text-neutral-100">Created "{create.data.entry.channel.name}"</Text>
        <Text className="text-neutral-500 dark:text-neutral-400">Give your agent this prompt. The code works once, for an hour.</Text>
        <Text selectable className="rounded-lg bg-neutral-100 p-3 font-mono text-sm text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
          {prompt}
        </Text>
        <Button label="Share prompt" onPress={() => Share.share({ message: prompt })} />
        <Button label="Open channel" variant="outline" onPress={() => router.replace(`/channel/${create.data.entry.channel.id}`)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-neutral-950" contentContainerClassName="gap-8 p-4" keyboardShouldPersistTaps="handled">
      {sessions.length > 1 && (
        <View className="flex-row flex-wrap gap-2">
          {sessions.map((s) => (
            <Pressable
              key={s.server}
              onPress={() => setServer(s.server)}
              className={`rounded-lg px-3 py-1.5 ${s.server === session?.server ? "bg-neutral-900 dark:bg-neutral-100" : "border border-neutral-300 dark:border-neutral-700"}`}
            >
              <Text className={s.server === session?.server ? "text-white dark:text-neutral-900" : "text-neutral-900 dark:text-neutral-100"}>{s.server.replace(/^https?:\/\//, "")}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View className="gap-3">
        <Text className="font-semibold text-neutral-900 dark:text-neutral-100">Create a channel</Text>
        <Text className="text-neutral-500 dark:text-neutral-400">You get a setup prompt to give your agent.</Text>
        <TextInput className={input} placeholder="Name, e.g. SEO bot" value={name} onChangeText={setName} />
        {create.error && <Text className="text-red-600">{create.error.message}</Text>}
        <Button label={create.isPending ? "Creating…" : "Create"} disabled={!name.trim() || !session || create.isPending} onPress={() => create.mutate()} />
      </View>
      <View className="gap-3">
        <Text className="font-semibold text-neutral-900 dark:text-neutral-100">Claim a channel your agent created</Text>
        <Text className="text-neutral-500 dark:text-neutral-400">Paste the link from rply init or rply pair, or enter its code.</Text>
        <TextInput className={input} autoCapitalize="none" autoCorrect={false} placeholder="Link or code, e.g. K7QX-M2PD" value={claimInput} onChangeText={setClaimInput} />
        {claim.error && <Text className="text-red-600">{claim.error.message}</Text>}
        <Button label={claim.isPending ? "Adding…" : "Add channel"} disabled={!claimInput.trim() || claim.isPending} onPress={() => claim.mutate()} />
      </View>
    </ScrollView>
  );
}
