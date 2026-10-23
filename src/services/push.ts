import { dictionary } from "@/constants/dictionary";
import { upsertPushSubscription } from "@/services/api";
import { getSupabaseClient } from "@/services/supabase";

const DISMISS_KEY = "bon-appetit.push-banner-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

export function isPushBannerDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissPushBanner(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    return;
  }
}

export async function registerPushSubscription(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error(dictionary.push.unsupported);
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(dictionary.push.denied);
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error(dictionary.push.failed);
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error(dictionary.push.failed);
  }

  await upsertPushSubscription(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
    },
    getSupabaseClient(),
  );
}

export async function syncGrantedPushSubscription(userId: string): Promise<void> {
  if (getNotificationPermission() !== "granted") {
    return;
  }
  await registerPushSubscription(userId);
}
