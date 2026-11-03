import {
  apiError,
  databaseRequest,
  isCronAuthorized,
  isExpiredSubscriptionError,
  isPushConfigured,
  sendPush,
  type PushDevice,
} from "../lib";

export const maxDuration = 60;

const weekdayNumbers: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type LocalClock = { date: string; time: string; weekday: number; minuteOfDay: number };

function localClock(date: Date, timezone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const time = `${values.hour}:${values.minute}`;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time,
    weekday: weekdayNumbers[values.weekday] ?? 0,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
  };
}

function isQuietTime(time: string, quietStart: string, quietEnd: string) {
  if (quietStart === quietEnd) return false;
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const now = toMinutes(time);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function scheduledNotification(device: PushDevice, now: Date) {
  let clock: LocalClock;
  try {
    clock = localClock(now, device.settings.timezone);
  } catch {
    return null;
  }
  if (isQuietTime(clock.time, device.settings.quietStart, device.settings.quietEnd)) return null;

  const lastActive = Date.parse(device.last_active_at);
  const inactiveForSevenDays = Number.isFinite(lastActive) && now.getTime() - lastActive >= 7 * 24 * 60 * 60 * 1000;
  if (
    device.settings.inactivityNudges &&
    inactiveForSevenDays &&
    device.settings.reminderDays.includes(clock.weekday) &&
    clock.time === device.settings.reminderTime
  ) {
    return {
      key: `${device.device_hash}:inactivity:${clock.date}:${clock.time}`,
      title: "A little space for something you love? 🌷",
      body: "Your hobbies are here whenever you feel like coming back.",
      url: "/?view=ideas",
    };
  }

  if (device.settings.weeklyRecaps && device.settings.recapDay === clock.weekday && device.settings.recapTime === clock.time) {
    return {
      key: `${device.device_hash}:recap:${clock.date}:${clock.time}`,
      title: "Your week in hobbies is ready ✨",
      body: "Come see what you’ve been up to.",
      url: "/?view=diary",
    };
  }

  if (device.settings.reminderDays.includes(clock.weekday) && clock.time === device.settings.reminderTime) {
    const evening = Number(clock.time.slice(0, 2)) >= 17;
    return {
      key: `${device.device_hash}:reminder:${clock.date}:${clock.time}`,
      title: evening ? "Your evening hobby break is waiting 💜" : "A little time for yourself? 🌷",
      body: evening ? "Your evening hobby break is waiting 💜" : "Fancy doing something you love?",
      url: "/?view=ideas",
    };
  }
  return null;
}

async function claimDelivery(deviceHash: string, deliveryKey: string) {
  const rows = await databaseRequest<{ delivery_key: string }[]>("push_deliveries?on_conflict=delivery_key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ delivery_key: deliveryKey, device_hash: deviceHash, status: "pending" }),
  });
  return rows.length > 0;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return apiError("Unauthorized.", 401);
  if (!isPushConfigured()) return apiError("Push notifications are not configured.", 503);

  try {
    const devices = await databaseRequest<PushDevice[]>(
      "push_devices?select=device_hash,subscription,settings,last_active_at",
    );
    let sent = 0;
    let skipped = 0;
    for (const device of devices) {
      const notification = scheduledNotification(device, new Date());
      if (!notification) continue;

      const claimed = await claimDelivery(device.device_hash, notification.key);
      if (!claimed) {
        skipped += 1;
        continue;
      }

      try {
        await sendPush(device.subscription, {
          title: notification.title,
          body: notification.body,
          url: notification.url,
          tag: notification.key,
        });
        await databaseRequest(`push_deliveries?delivery_key=eq.${encodeURIComponent(notification.key)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "sent", delivered_at: new Date().toISOString() }),
        });
        sent += 1;
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          await databaseRequest(`push_devices?device_hash=eq.${device.device_hash}`, { method: "DELETE" });
        } else {
          await databaseRequest(`push_deliveries?delivery_key=eq.${encodeURIComponent(notification.key)}`, {
            method: "DELETE",
          });
          console.error("Scheduled push delivery failed.");
        }
      }
    }
    return Response.json({ sent, skipped });
  } catch {
    return apiError("Scheduled notifications could not be processed.", 503);
  }
}
