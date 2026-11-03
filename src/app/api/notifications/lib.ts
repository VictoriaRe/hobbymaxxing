import { createHash, timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { isNotificationSettings, type NotificationSettings } from "../../notification-types";

export type PushSubscriptionData = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type PushDevice = {
  device_hash: string;
  subscription: PushSubscriptionData;
  settings: NotificationSettings;
  last_active_at: string;
};

export function isStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isPushConfigured() {
  return Boolean(
    process.env.PUSH_NOTIFICATIONS_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT &&
    isStorageConfigured() &&
    process.env.CRON_SECRET,
  );
}

export function pushConfig() {
  return {
    configured: isPushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
  };
}

export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function deviceHashFromRequest(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/i)?.[1];
  if (!token) return null;
  return createHash("sha256").update(token.toLowerCase()).digest("hex");
}

export async function databaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error("Supabase server credentials are not configured.");

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    console.error("Supabase notification request failed:", response.status);
    throw new Error("Notification storage is temporarily unavailable.");
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function validSettings(value: unknown): value is NotificationSettings {
  if (!isNotificationSettings(value)) return false;
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    !timePattern.test(value.reminderTime) ||
    !timePattern.test(value.recapTime) ||
    !timePattern.test(value.quietStart) ||
    !timePattern.test(value.quietEnd) ||
    Number(value.reminderTime.slice(3, 5)) % 5 !== 0 ||
    Number(value.recapTime.slice(3, 5)) % 5 !== 0 ||
    value.reminderDays.length > 7 ||
    value.timezone.length > 100
  ) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = hostname === "fcm.googleapis.com" ||
      hostname === "updates.push.services.mozilla.com" ||
      hostname === "web.push.apple.com" ||
      hostname.endsWith(".push.apple.com") ||
      hostname.endsWith(".notify.windows.com");
    return url.protocol === "https:" && !url.username && !url.password && url.port === "" && trustedHost;
  } catch {
    return false;
  }
}

export function isValidSubscription(value: unknown): value is PushSubscriptionData {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<PushSubscriptionData>;
  return typeof subscription.endpoint === "string" &&
    subscription.endpoint.length <= 2048 &&
    isAllowedPushEndpoint(subscription.endpoint) &&
    Boolean(subscription.keys && typeof subscription.keys.p256dh === "string" && subscription.keys.p256dh.length > 0 && subscription.keys.p256dh.length <= 256) &&
    Boolean(subscription.keys && typeof subscription.keys.auth === "string" && subscription.keys.auth.length > 0 && subscription.keys.auth.length <= 256);
}

export function setVapidDetails() {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    throw new Error("VAPID credentials are not configured.");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function sendPush(subscription: PushSubscriptionData, payload: {
  title: string;
  body: string;
  url: string;
  tag: string;
}) {
  setVapidDetails();
  await webpush.sendNotification(subscription, JSON.stringify({
    ...payload,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  }));
}

export function isExpiredSubscriptionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode = (error as { statusCode?: number }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

export function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || !providedSecret) return false;
  const expected = Buffer.from(configuredSecret);
  const actual = Buffer.from(providedSecret);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
