import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { signInAsOwner, signOutOwner, useOwners } from "@/lib/channels";

const input = "rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100";

export default function Owner() {
  const owners = useOwners();
  const [server, setServer] = useState("");
  const [token, setToken] = useState("");
  const signIn = useMutation({ mutationFn: () => signInAsOwner(server, token.trim()), onSuccess: () => router.back() });

  return (
    <ScrollView className="flex-1 bg-white dark:bg-neutral-950" contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
      <Text className="text-neutral-500 dark:text-neutral-400">
        Enter a server's RPLY_ADMIN_TOKEN to see every channel on it, without pairing each one.
      </Text>
      <TextInput className={input} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Server, e.g. rply.example.com" value={server} onChangeText={setServer} />
      <TextInput className={input} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Admin token" value={token} onChangeText={setToken} />
      {signIn.error && <Text className="text-red-600">{signIn.error.message}</Text>}
      <Button label={signIn.isPending ? "Signing in…" : "Sign in"} disabled={!server.trim() || !token.trim() || signIn.isPending} onPress={() => signIn.mutate()} />

      {owners.length > 0 && (
        <View className="gap-2 pt-4">
          <Text className="font-semibold text-neutral-900 dark:text-neutral-100">Signed in</Text>
          {owners.map((o) => (
            <View key={o.server} className="flex-row items-center justify-between gap-2">
              <Text numberOfLines={1} className="flex-1 text-neutral-700 dark:text-neutral-300">
                {o.server}
              </Text>
              <Button label="Sign out" variant="outline" onPress={() => signOutOwner(o.server)} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
