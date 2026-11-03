"use client";

import { useEffect, useState } from "react";
import { isNotificationSettings, suggestedNotificationSettings, type NotificationSettings } from "./notification-types";

const DEVICE_TOKEN_KEY = "hobbymaxxing-push-device-token";
const SETTINGS_KEY = "hobbymaxxing-notification-settings";
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  preferredTimes: string[];
  onBack: () => void;
};

type PushConfig = { configured: boolean; publicKey?: string };

function base64UrlToBytes(value: string) {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const decoded = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function createDeviceToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function responseError(response: Response) {
  const result = await response.json().catch(() => null) as { error?: string } | null;
  return result?.error ?? "The notification request could not be completed.";
}

export default function NotificationSettings({ preferredTimes, onBack }: Props) {
  const [settings, setSettings] = useState(() => suggestedNotificationSettings(preferredTimes));
  const [configured, setConfigured] = useState(false);
  const [supported, setSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
      setIsIOS(iosDevice);
      setIsStandalone(standalone);
      const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setSupported(canPush);
      if (canPush) setPermission(Notification.permission);

      try {
        const saved = window.localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isNotificationSettings(parsed)) setSettings(parsed);
        } else {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (timezone) setSettings((current) => ({ ...current, timezone }));
        }
      } catch {
        setError("Saved notification settings could not be read. You can set them again here.");
      }
      let token: string | null;
      try {
        token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
      } catch {
        setError("This browser could not read the saved notification device token.");
        token = null;
      }
      if (token && canPush) {
        navigator.serviceWorker.getRegistration("/").then(async (registration) => {
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription && Notification.permission === "granted") setEnabled(true);
        }).catch((caught: unknown) => {
          setError(caught instanceof Error ? caught.message : "The saved notification subscription could not be checked.");
        });
      }
      setSettingsLoaded(true);
    }, 0);

    fetch("/api/notifications/config")
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return await response.json() as PushConfig;
      })
      .then((config) => setConfigured(config.configured && Boolean(config.publicKey)))
      .catch(() => setConfigured(false));

    return () => window.clearTimeout(initialize);
  }, []);

  function updateSettings(update: Partial<NotificationSettings>) {
    setSettings((current) => {
      const next = { ...current, ...update };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        setError("Your browser could not save these settings on this device.");
      }
      return next;
    });
    setMessage("");
  }

  async function saveToServer(subscription: PushSubscription, token: string, nextSettings: NotificationSettings) {
    const response = await fetch("/api/notifications/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: subscription.toJSON(), settings: nextSettings }),
    });
    if (!response.ok) throw new Error(await responseError(response));
  }

  async function enableNotifications() {
    setBusy(true);
    setMessage("");
    setError("");
    let subscription: PushSubscription | null = null;
    let createdSubscription = false;
    try {
      if (!supported) throw new Error("Push notifications are not supported in this browser.");
      if (isIOS && !isStandalone) {
        throw new Error("On iPhone, add Hobbymaxxing to your Home Screen first, then open the installed app to enable notifications.");
      }

      const permissionResult = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        throw new Error(permissionResult === "denied"
          ? "Notifications are blocked in browser settings. Change that there if you want to enable them; we won’t prompt again."
          : "Notification permission was not granted.");
      }

      const configResponse = await fetch("/api/notifications/config");
      if (!configResponse.ok) throw new Error(await responseError(configResponse));
      const config = await configResponse.json() as PushConfig;
      if (!config.configured || !config.publicKey) throw new Error("Push delivery has not been configured on this deployment yet.");

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(config.publicKey),
        });
        createdSubscription = true;
      }
      const token = window.localStorage.getItem(DEVICE_TOKEN_KEY) ?? createDeviceToken();
      window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
      await saveToServer(subscription, token, settings);
      setConfigured(true);
      setEnabled(true);
      setMessage("Your device is subscribed. Send a test notification to confirm delivery.");
    } catch (caught) {
      if (subscription && createdSubscription) await subscription.unsubscribe().catch(() => false);
      setError(caught instanceof Error ? caught.message : "Notifications could not be enabled.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!token || !subscription) throw new Error("This device is not subscribed yet.");
      await saveToServer(subscription, token, settings);
      setMessage("Your reminder schedule has been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your schedule could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
      let cleanupWarning = "";
      if (token) {
        const response = await fetch("/api/notifications/settings", {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          if (response.status === 503) cleanupWarning = await responseError(response);
          else throw new Error(await responseError(response));
        }
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      window.localStorage.removeItem(DEVICE_TOKEN_KEY);
      setEnabled(false);
      if (cleanupWarning) setError(`Notifications are off on this device, but server cleanup could not be confirmed: ${cleanupWarning}`);
      else setMessage("Notifications are off for this device.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications could not be disabled.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
      if (!token) throw new Error("Enable notifications on this device first.");
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage("A test notification was submitted. Check that it arrives on this device.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The test notification could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(day: number) {
    const reminderDays = settings.reminderDays.includes(day)
      ? settings.reminderDays.filter((selected) => selected !== day)
      : [...settings.reminderDays, day].sort((first, second) => first - second);
    updateSettings({ reminderDays });
  }

  return (
    <section className="notification-settings" aria-labelledby="notification-settings-title">
      <div className="notification-settings-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Gentle reminders, only if you want them</p>
          <h1 id="notification-settings-title">Notification <em>settings.</em></h1>
          <p>Make a little room for the things you love. You can switch these off whenever you like.</p>
        </div>
        <button className="quiet-button" type="button" onClick={onBack}>Back to ideas</button>
      </div>

      <div className="notification-card">
        <div className="notification-enable-row">
          <div><h2>Push notifications</h2><p>{enabled ? "Subscribed on this device" : configured ? "Off until you choose to enable them" : "Not configured on this deployment yet"}</p></div>
          {enabled
            ? <button className="secondary-button" type="button" disabled={busy} onClick={disableNotifications}>Turn off</button>
            : <button className="primary-button" type="button" disabled={busy || !configured || !supported || (permission === "denied") || (isIOS && !isStandalone)} onClick={enableNotifications}>{busy ? "One moment…" : "Enable notifications"}</button>}
        </div>
        {!configured && <p className="notification-note" role="status">Push delivery is not operational until Supabase, VAPID, and scheduled delivery are configured.</p>}
        {!supported && <p className="notification-note">This browser does not support Web Push. Try a supported browser or an iPhone Home Screen app on iOS 16.4 or later.</p>}
        {isIOS && !isStandalone && <p className="notification-note">On iPhone, open this site in Safari, tap Share, then Add to Home Screen. Open the installed app before enabling notifications (iOS 16.4+).</p>}
        {permission === "denied" && <p className="notification-note">Permission is blocked by your browser. Change it in system or browser settings; Hobbymaxxing will not keep asking.</p>}

        <fieldset className="notification-fieldset" disabled={busy || !settingsLoaded}>
          <legend>Hobby reminders</legend>
          <p className="notification-note">Suggested from your onboarding availability: {preferredTimes.length ? preferredTimes.join(", ") : "weekdays"}.</p>
          <div className="notification-days" role="group" aria-label="Reminder days">
            {dayLabels.map((label, day) => <button className={settings.reminderDays.includes(day) ? "selected" : ""} type="button" aria-pressed={settings.reminderDays.includes(day)} key={label} onClick={() => toggleDay(day)}>{label}</button>)}
          </div>
          <label className="notification-time">Reminder time<input type="time" step="300" value={settings.reminderTime} onChange={(event) => updateSettings({ reminderTime: event.target.value })} /></label>
          <label className="notification-check"><input type="checkbox" checked={settings.weeklyRecaps} onChange={(event) => updateSettings({ weeklyRecaps: event.target.checked })} /> Send me a weekly recap</label>
          {settings.weeklyRecaps && <div className="notification-inline-fields">
            <label>Recap day<select value={settings.recapDay} onChange={(event) => updateSettings({ recapDay: Number(event.target.value) })}>{dayLabels.map((label, day) => <option value={day} key={label}>{label}</option>)}</select></label>
            <label>Recap time<input type="time" step="300" value={settings.recapTime} onChange={(event) => updateSettings({ recapTime: event.target.value })} /></label>
          </div>}
          <label className="notification-check"><input type="checkbox" checked={settings.inactivityNudges} onChange={(event) => updateSettings({ inactivityNudges: event.target.checked })} /> Optional inactivity nudges <span>(off by default)</span></label>
          <div className="notification-inline-fields">
            <label>Quiet hours start<input type="time" value={settings.quietStart} onChange={(event) => updateSettings({ quietStart: event.target.value })} /></label>
            <label>Quiet hours end<input type="time" value={settings.quietEnd} onChange={(event) => updateSettings({ quietEnd: event.target.value })} /></label>
          </div>
          <label className="notification-time">Timezone
            <input list="notification-timezones" value={settings.timezone} onChange={(event) => updateSettings({ timezone: event.target.value })} />
            <datalist id="notification-timezones">{["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney"].map((timezone) => <option value={timezone} key={timezone} />)}</datalist>
          </label>
          <p className="notification-note">Your timezone: {settings.timezone}. Times follow this timezone, including daylight-saving changes.</p>
        </fieldset>

        <div className="notification-actions">
          {enabled && <button className="secondary-button" type="button" disabled={busy} onClick={saveSchedule}>Save schedule</button>}
          {enabled && <button className="secondary-button" type="button" disabled={busy} onClick={sendTest}>Send a test notification</button>}
        </div>
        {message && <p className="notification-message" role="status">{message}</p>}
        {error && <p className="notification-error" role="alert">{error}</p>}
      </div>

      <div className="notification-examples">
        <h2>A little note from us</h2>
        <p>“A little time for yourself? 🌷 Fancy doing something you love?”</p>
        <p>“Your evening hobby break is waiting 💜”</p>
        <p>“Your week in hobbies is ready ✨ Come see what you’ve been up to.”</p>
        <small>Subscriptions are specific to this browser and device. Your hobby diary stays on this device and is not shared with notification delivery.</small>
      </div>
    </section>
  );
}
