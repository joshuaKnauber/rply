import { useEffect } from "react";
import { api } from "./api";
import { useAdminToken, type StoredChannel } from "./channels";
import { createStore } from "./store";

const endpoint = createStore<string | null>("rply.push", null);
export const usePushEndpoint = endpoint.use;
export const pushEndpoint = endpoint.get;

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const needsHomeScreen = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone;

export const registerServiceWorker = () => (pushSupported() ? navigator.serviceWorker.register("/sw.js").catch(() => undefined) : undefined);

const keyBytes = (base64Url: string) => {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

const tokensOf = (channels: StoredChannel[]) => channels.filter((c) => !c.revoked && !c.admin).map((c) => c.token);

const save = (subscription: PushSubscription, channels: StoredChannel[], admin: string | null) =>
  api("/push/subscription", { method: "PUT", token: admin ?? undefined, body: { subscription: subscription.toJSON(), tokens: tokensOf(channels) } });

export async function enablePush(publicKey: string, channels: StoredChannel[], admin: string | null) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked for this site. Allow them in the browser's site settings.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  await (await registration.pushManager.getSubscription())?.unsubscribe();
  const subscription = await registration.pushManager
    .subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
    .catch((err: Error) => {
      if (err.name === "AbortError") throw new Error("This browser has no push service. Try Chrome, Firefox, Edge or Safari.");
      throw err;
    });
  await save(subscription, channels, admin);
  endpoint.update(() => subscription.endpoint);
}

export async function disablePush() {
  const subscription = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (subscription) {
    await api("/push/subscription", { method: "DELETE", body: { endpoint: subscription.endpoint } }).catch(() => undefined);
    await subscription.unsubscribe();
  }
  endpoint.update(() => null);
}

export function usePushSync(channels: StoredChannel[]) {
  const current = usePushEndpoint();
  const admin = useAdminToken();
  const key = `${tokensOf(channels).join(",")}|${admin ?? ""}`;

  useEffect(() => {
    if (!current || !pushSupported()) return;
    (async () => {
      const subscription = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (!subscription || Notification.permission !== "granted") return endpoint.update(() => null);
      await save(subscription, channels, admin).catch(() => undefined);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, key]);
}
