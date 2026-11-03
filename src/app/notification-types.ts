export type NotificationSettings = {
  reminderDays: number[];
  reminderTime: string;
  weeklyRecaps: boolean;
  recapDay: number;
  recapTime: string;
  inactivityNudges: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

export function suggestedNotificationSettings(preferredTimes: string[]): NotificationSettings {
  const hasWeekdays = preferredTimes.some((time) => time.startsWith("Weekday"));
  const hasWeekends = preferredTimes.some((time) => time.startsWith("Weekend"));
  const reminderDays = hasWeekdays && hasWeekends
    ? [...WEEKDAYS, ...WEEKEND]
    : hasWeekends
      ? WEEKEND
      : WEEKDAYS;
  const reminderTime = preferredTimes.some((time) => time.endsWith("evenings"))
    ? "19:00"
    : preferredTimes.some((time) => time.endsWith("mornings"))
      ? "09:00"
      : "12:00";

  return {
    reminderDays: [...reminderDays].sort((first, second) => first - second),
    reminderTime,
    weeklyRecaps: false,
    recapDay: 0,
    recapTime: "18:00",
    inactivityNudges: false,
    quietStart: "22:00",
    quietEnd: "07:00",
    timezone: "UTC",
  };
}

export function isNotificationSettings(value: unknown): value is NotificationSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<NotificationSettings>;
  return Array.isArray(settings.reminderDays) &&
    settings.reminderDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    typeof settings.reminderTime === "string" &&
    typeof settings.weeklyRecaps === "boolean" &&
    Number.isInteger(settings.recapDay) && (settings.recapDay ?? -1) >= 0 && (settings.recapDay ?? 7) <= 6 &&
    typeof settings.recapTime === "string" &&
    typeof settings.inactivityNudges === "boolean" &&
    typeof settings.quietStart === "string" &&
    typeof settings.quietEnd === "string" &&
    typeof settings.timezone === "string";
}
