import { useEffect } from "react";
import { api } from "./api";
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

const save = (subscription: PushSubscription) => api("/push/subscription", { method: "PUT", body: { subscription: subscription.toJSON() } });

export async function enablePush(publicKey: string) {
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
  await save(subscription);
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

// re-registers this browser's subscription for whoever is signed in
export function usePushSync(userId: string) {
  const current = usePushEndpoint();

  useEffect(() => {
    if (!current || !pushSupported()) return;
    (async () => {
      const subscription = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (!subscription || Notification.permission !== "granted") return endpoint.update(() => null);
      await save(subscription).catch(() => undefined);
    })();
  }, [current, userId]);
}
