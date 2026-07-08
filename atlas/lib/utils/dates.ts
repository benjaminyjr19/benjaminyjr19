/**
 * Small date helpers — deliberately dependency-free.
 * All functions work with ISO date strings (YYYY-MM-DD) in local time.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Monday of the upcoming week (next Monday; if today is Monday, today). */
export function upcomingMonday(from: Date = new Date()): Date {
  const day = from.getDay(); // 0 Sun … 6 Sat
  const offset = day === 1 ? 0 : (8 - day) % 7;
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** "13–17 July" or "28 July – 1 August" across month boundaries. */
export function formatWeekRange(weekStartISO: string, weekEndISO: string): string {
  const start = parseISODate(weekStartISO);
  const end = parseISODate(weekEndISO);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString("en-GB", { month: "long" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "long" });
  if (startMonth === endMonth) return `${startDay}–${endDay} ${endMonth}`;
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "just now", "2h ago", "3d ago" — quiet, imprecise on purpose. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return parseISODate(iso.slice(0, 10)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Current hour in the centre's timezone; falls back to server time. */
export function hourInTimezone(timezone: string, now: Date = new Date()): number {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(now);
    return Number(hour) % 24;
  } catch {
    return now.getHours();
  }
}
