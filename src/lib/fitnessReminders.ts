const MEAL_WINDOWS: { type: "breakfast" | "lunch" | "dinner"; endHour: number; label: string }[] = [
  { type: "breakfast", endHour: 10, label: "早餐" },
  { type: "lunch", endHour: 14, label: "午餐" },
  { type: "dinner", endHour: 20, label: "晚餐" },
];

// Returns the most recent meal window that has closed without a logged meal of
// that type today, or null if nothing is overdue yet.
export function getMissedMealReminder(
  loggedMealTypes: string[],
  now: Date
): { type: string; label: string } | null {
  const hour = now.getHours();
  for (const w of [...MEAL_WINDOWS].reverse()) {
    if (hour >= w.endHour && !loggedMealTypes.includes(w.type)) {
      return { type: w.type, label: w.label };
    }
  }
  return null;
}
