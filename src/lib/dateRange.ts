import {
  taipeiDayRange,
  taipeiMonthRange,
  taipeiYearRange,
  parseTaipeiDateKey,
  addDays,
} from "@/lib/fitnessTimezone";
import { getWeekStart } from "@/lib/fitnessWeek";

export type DateRange = { start: Date; end: Date };

export function getDayRange(date: Date): DateRange {
  return taipeiDayRange(date);
}

// Monday-to-Sunday week containing `date`.
export function getWeekRange(date: Date): DateRange {
  const start = getWeekStart(date);
  return { start, end: addDays(start, 7) };
}

export function getMonthRange(date: Date): DateRange {
  return taipeiMonthRange(date);
}

export function getYearRange(date: Date): DateRange {
  return taipeiYearRange(date);
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Resolve an optional "YYYY-MM-DD" request param to that Taipei date, or now.
export function resolveDate(dateParam?: string | null): Date {
  return dateParam && DATE_KEY_PATTERN.test(dateParam) ? parseTaipeiDateKey(dateParam) : new Date();
}

// Resolve an optional "YYYY-MM-DD" request param to that day's Taipei range.
export function resolveDayRange(dateParam?: string | null): DateRange {
  return getDayRange(resolveDate(dateParam));
}
