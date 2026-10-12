import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { disablePush } from "./push";

export const authClient = createAuthClient({ baseURL: `${location.origin}/v1/auth`, plugins: [passkeyClient(), magicLinkClient()] });

export const useSession = authClient.useSession;

// better-auth reports failures as { error } instead of throwing, react-query wants a rejection
export async function orThrow<T>(promise: Promise<{ data: T; error: { message?: string; statusText?: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message ?? error.statusText ?? "Something went wrong");
  return data;
}

export async function signOut(clearCache: () => void) {
  await disablePush().catch(() => undefined);
  await authClient.signOut();
  clearCache();
}
