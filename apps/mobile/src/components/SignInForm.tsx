import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { DEFAULT_SERVER, signIn } from "@/lib/sessions";
import { Button } from "./Button";

const input = "rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100";

export function SignInForm({ askServer = false, onDone }: { askServer?: boolean; onDone?: () => void }) {
  const [custom, setCustom] = useState(askServer);
  const [server, setServer] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const submit = useMutation({
    mutationFn: () => signIn(custom ? server : DEFAULT_SERVER, email.trim(), password, create),
    onSuccess: () => onDone?.(),
  });

  return (
    <View className="gap-3">
      {custom ? (
        <TextInput className={input} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Server, e.g. rply.example.com" value={server} onChangeText={setServer} />
      ) : (
        <Pressable onPress={() => setCustom(true)}>
          <Text className="text-neutral-500 dark:text-neutral-400">
            On rply.sh. <Text className="text-neutral-900 underline dark:text-neutral-100">Use another server</Text>
          </Text>
        </Pressable>
      )}
      <TextInput className={input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput className={input} secureTextEntry autoComplete={create ? "new-password" : "current-password"} placeholder={create ? "Password, at least 8 characters" : "Password"} value={password} onChangeText={setPassword} />
      {submit.error && <Text className="text-red-600">{submit.error.message}</Text>}
      <Button
        label={submit.isPending ? "One moment…" : create ? "Create account" : "Sign in"}
        disabled={!email.trim() || !password || (custom && !server.trim()) || submit.isPending}
        onPress={() => submit.mutate()}
      />
      <Pressable onPress={() => (setCreate(!create), submit.reset())}>
        <Text className="text-center text-neutral-500 dark:text-neutral-400">{create ? "I have an account" : "Create an account"}</Text>
      </Pressable>
    </View>
  );
}
