// All "today" calculations in the fitness module are pinned to Asia/Taipei
// (fixed UTC+8, no DST) instead of the server process's ambient timezone.
// Serverless runtimes commonly default to UTC, which silently mis-dates
// anything entered between 00:00-08:00 Taipei time onto the previous day.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type TaipeiParts = { year: number; month: number; day: number; weekday: number };

function taipeiParts(date: Date): TaipeiParts {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0=Sun..6=Sat
  };
}

function taipeiMidnightUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - TAIPEI_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// Absolute instant for 00:00 Taipei time on the Taipei calendar day `date` falls on.
export function taipeiStartOfDay(date: Date = new Date()): Date {
  const { year, month, day } = taipeiParts(date);
  return taipeiMidnightUTC(year, month, day);
}

// Parse a "YYYY-MM-DD" key as 00:00 Taipei time on that date.
export function parseTaipeiDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return taipeiMidnightUTC(year, month - 1, day);
}

// "YYYY-MM-DD" for the Taipei calendar date `date` falls on.
export function formatTaipeiDateKey(date: Date = new Date()): string {
  const { year, month, day } = taipeiParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function taipeiDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = taipeiStartOfDay(date);
  return { start, end: addDays(start, 1) };
}

export function taipeiMonthRange(date: Date = new Date()): { start: Date; end: Date } {
  const { year, month } = taipeiParts(date);
  const start = taipeiMidnightUTC(year, month, 1);
  const end = taipeiMidnightUTC(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, 1);
  return { start, end };
}

export function taipeiYearRange(date: Date = new Date()): { start: Date; end: Date } {
  const { year } = taipeiParts(date);
  return { start: taipeiMidnightUTC(year, 0, 1), end: taipeiMidnightUTC(year + 1, 0, 1) };
}

// Monday=0..Sunday=6, based on the Taipei calendar date `date` falls on.
export function taipeiWeekdayIndex(date: Date = new Date()): number {
  const { weekday } = taipeiParts(date);
  return weekday === 0 ? 6 : weekday - 1;
}
