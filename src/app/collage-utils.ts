import type { DiaryEntry } from "./activity-experience";

export type CollageFormat = "story" | "square";
export type CollageDimensions = { width: 1080; height: 1920 } | { width: 1080; height: 1080 };

export function getCollageDimensions(format: CollageFormat): CollageDimensions {
  return format === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
}

export function getWeekStart(timestamp: number): string {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getCollageWeekOptions(entries: DiaryEntry[], timestamp: number, count = 12): string[] {
  const recentWeeks = Array.from({ length: count }, (_, index) => {
    const date = new Date(timestamp);
    date.setDate(date.getDate() - index * 7);
    return getWeekStart(date.getTime());
  });
  const photoWeeks = entries
    .filter((entry) => entry.status === "completed" && entry.photoDataUrl)
    .map((entry) => getWeekStart(entry.finishedAt));
  return [...new Set([...recentWeeks, ...photoWeeks])].sort((first, second) => second.localeCompare(first));
}

export function getPhotosForWeek(entries: DiaryEntry[], weekStart: string): DiaryEntry[] {
  if (!weekStart) return [];
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(year, month - 1, day).getTime();
  const end = new Date(year, month - 1, day + 7).getTime();
  return entries
    .filter((entry) => entry.status === "completed" && Boolean(entry.photoDataUrl) && entry.finishedAt >= start && entry.finishedAt < end)
    .sort((first, second) => first.finishedAt - second.finishedAt);
}

export function formatWeekLabel(weekStart: string): string {
  if (!weekStart) return "";
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 6);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}
