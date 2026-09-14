import type { CARDIO_ACTIVITY_TYPES } from "@/models/fitness/CardioLog";

type ActivityType = (typeof CARDIO_ACTIVITY_TYPES)[number];

// Representative MET (metabolic equivalent) value per activity type — a single
// moderate-intensity value per type, not adjusted for pace/effort.
const MET_VALUES: Record<ActivityType, number> = {
  walk: 3.5,
  run: 8.0,
  cycle: 6.0,
  swim: 6.0,
  other: 5.0,
};

// Calories burned ≈ MET × body weight (kg) × duration (hours).
export function estimateCaloriesBurned(
  activityType: ActivityType,
  durationMinutes: number,
  weightKg: number
): number {
  const met = MET_VALUES[activityType];
  const hours = durationMinutes / 60;
  return Math.round(met * weightKg * hours);
}
