import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { SignInForm } from "@/components/SignInForm";
import { channelsKey } from "@/lib/channels";
import { signOut, useSessions } from "@/lib/sessions";

export default function Account() {
  const sessions = useSessions();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-neutral-950" contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
      <View className="gap-3">
        {sessions.map((s) => (
          <View key={s.server} className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text numberOfLines={1} className="font-medium text-neutral-900 dark:text-neutral-100">
                {s.email}
              </Text>
              <Text numberOfLines={1} className="text-sm text-neutral-500">
                {s.server.replace(/^https?:\/\//, "")}
              </Text>
            </View>
            <Button label="Sign out" variant="outline" onPress={() => signOut(s).then(() => queryClient.removeQueries({ queryKey: channelsKey(s.server) }))} />
          </View>
        ))}
      </View>
      {adding ? (
        <View className="gap-3">
          <Text className="font-semibold text-neutral-900 dark:text-neutral-100">Sign in to another server</Text>
          <SignInForm askServer onDone={() => setAdding(false)} />
        </View>
      ) : (
        <Button label="Sign in to another server" variant="outline" onPress={() => setAdding(true)} />
      )}
    </ScrollView>
  );
}
