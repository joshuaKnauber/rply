import "../global.css";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loadStores, useChannels } from "@/lib/channels";
import { SyncAll } from "@/lib/sync";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadStores().finally(() => {
      setReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <Sync />
        <Stack>
          <Stack.Screen name="index" options={{ title: "rply" }} />
          <Stack.Screen name="channel/[id]" options={{ title: "" }} />
          <Stack.Screen name="add" options={{ title: "Add channel", presentation: "modal" }} />
          <Stack.Screen name="owner" options={{ title: "Sign in as owner", presentation: "modal" }} />
        </Stack>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function Sync() {
  return <SyncAll channels={useChannels()} />;
}
