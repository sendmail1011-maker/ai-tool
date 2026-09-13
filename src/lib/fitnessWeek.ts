// Monday 00:00 local time of the week containing `date`.
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function getTodayDayIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0 ... Sunday = 6
}
