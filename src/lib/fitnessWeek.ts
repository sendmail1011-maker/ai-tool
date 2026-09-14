import { taipeiStartOfDay, taipeiWeekdayIndex, addDays } from "@/lib/fitnessTimezone";

// Monday 00:00 Taipei time of the week containing `date`.
export function getWeekStart(date: Date): Date {
  const startOfDay = taipeiStartOfDay(date);
  const weekdayIndex = taipeiWeekdayIndex(date); // Monday=0 .. Sunday=6
  return addDays(startOfDay, -weekdayIndex);
}

export function getTodayDayIndex(date: Date): number {
  return taipeiWeekdayIndex(date);
}
