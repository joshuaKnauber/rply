import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { SignInForm } from "@/components/SignInForm";
import { channelsKey } from "@/lib/channels";
import { deleteAccount, signOut, useSessions, type Session } from "@/lib/sessions";

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
      <View className="gap-3">
        {sessions.map((s) => (
          <DeleteAccount key={s.server} session={s} />
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

function DeleteAccount({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const remove = useMutation({
    mutationFn: () => deleteAccount(session, password),
    onSuccess: () => queryClient.removeQueries({ queryKey: channelsKey(session.server) }),
  });

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)}>
        <Text className="text-red-600">Delete account on {session.server.replace(/^https?:\/\//, "")}</Text>
      </Pressable>
    );
  }
  return (
    <View className="gap-3 rounded-xl border border-red-200 p-3 dark:border-red-900">
      <Text className="text-neutral-700 dark:text-neutral-300">
        Deletes {session.email} and every channel it owns, with their messages, files and apps. Their agents lose access. This can't be undone.
      </Text>
      <TextInput
        className="rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
        secureTextEntry
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
      />
      {remove.error && <Text className="text-red-600">{remove.error.message}</Text>}
      <Pressable disabled={remove.isPending} onPress={() => remove.mutate()} className="items-center rounded-lg bg-red-600 px-4 py-2.5">
        <Text className="font-medium text-white">{remove.isPending ? "Deleting…" : "Delete everything"}</Text>
      </Pressable>
      <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} />
    </View>
  );
}
