import { ADMIN_MENU_DEADLINE_HOUR, TIMEZONE } from "@/constants/deadlines";

export function todayKyivIsoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function defaultMenuCatalogRange(now = new Date()): { from: string; to: string } {
  const today = todayKyivIsoDate(now);
  return { from: addDaysIso(today, -2), to: addDaysIso(today, 2) };
}

export function eachIsoDateInRange(from: string, to: string): string[] {
  if (from > to) {
    return [];
  }
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = addDaysIso(current, 1);
  }
  return dates;
}

export function formatWeekdayUk(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC",
    weekday: "long",
  }).format(date);
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utc));
}

/** Default order target date: tomorrow in Europe/Kyiv. */
export function defaultOrderTargetDate(now = new Date()): string {
  return addDaysIso(todayKyivIsoDate(now), 1);
}

/** Order for date D is open while the Kyiv calendar day is still D-1. */
export function isUserOrderDeadlineOpen(targetDate: string, now = new Date()): boolean {
  return todayKyivIsoDate(now) < targetDate;
}

export function kyivHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

/** Menu for date D is open until 10:00 of D-1 in Europe/Kyiv. */
export function isAdminMenuDeadlineOpen(targetDate: string, now = new Date()): boolean {
  const dayBefore = addDaysIso(targetDate, -1);
  const today = todayKyivIsoDate(now);
  if (today < dayBefore) {
    return true;
  }
  if (today > dayBefore) {
    return false;
  }
  return kyivHour(now) < ADMIN_MENU_DEADLINE_HOUR;
}

export function formatKyivNow(now = new Date()): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(now);
}

export function formatDateUk(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
