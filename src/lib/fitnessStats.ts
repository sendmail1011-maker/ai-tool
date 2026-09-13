import { getFitnessModels } from "@/lib/mongoose-fitness";
import { getDayRange, getMonthRange, getYearRange } from "@/lib/dateRange";

export type StatsRange = "day" | "month" | "year";

export type FitnessStats = {
  range: StatsRange;
  start: string;
  end: string;
  weight: {
    count: number;
    avgKg: number;
    firstKg: number;
    latestKg: number;
    changeKg: number;
  } | null;
  exercise: {
    trainingDaysCompleted: number;
    totalExercises: number;
    totalSets: number;
  } | null;
  food: {
    loggedMeals: number;
    loggedDays: number;
    totalCalories: number;
    avgCaloriesPerLoggedDay: number;
    avgProteinG: number;
    avgCarbsG: number;
    avgFatG: number;
  } | null;
  water: {
    loggedDays: number;
    totalMl: number;
    avgMlPerLoggedDay: number;
  } | null;
  sleep: {
    loggedNights: number;
    avgHours: number;
    qualityBreakdown: { good: number; ok: number; poor: number };
  } | null;
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function average(nums: number[]) {
  return nums.length ? sum(nums) / nums.length : 0;
}

function round0(n: number) {
  return Math.round(n);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function dateKey(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

function countDistinctDays(dates: Date[]) {
  return new Set(dates.map(dateKey)).size;
}

export async function computeFitnessStats(
  userId: string,
  range: StatsRange,
  refDate: Date
): Promise<FitnessStats> {
  const { start, end } =
    range === "month" ? getMonthRange(refDate) : range === "year" ? getYearRange(refDate) : getDayRange(refDate);

  const { WeightLog, WorkoutPlan, MealLog, WaterLog, SleepLog } = await getFitnessModels();

  const [weightLogs, mealLogs, waterLogs, sleepLogs, workoutPlans] = await Promise.all([
    WeightLog.find({ userId, date: { $gte: start, $lt: end } }).sort({ date: 1 }),
    MealLog.find({ userId, date: { $gte: start, $lt: end } }),
    WaterLog.find({ userId, date: { $gte: start, $lt: end } }),
    SleepLog.find({ userId, date: { $gte: start, $lt: end } }),
    // A WorkoutPlan's 7 days can spill past its own weekStart, so widen the
    // fetch window by a week and filter to exact calendar dates below.
    WorkoutPlan.find({
      userId,
      weekStart: { $gte: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000), $lt: end },
    }),
  ]);

  const weight =
    weightLogs.length > 0
      ? {
          count: weightLogs.length,
          avgKg: round1(average(weightLogs.map((w) => w.weightKg))),
          firstKg: weightLogs[0].weightKg,
          latestKg: weightLogs[weightLogs.length - 1].weightKg,
          changeKg: round1(weightLogs[weightLogs.length - 1].weightKg - weightLogs[0].weightKg),
        }
      : null;

  const food =
    mealLogs.length > 0
      ? (() => {
          const loggedDays = countDistinctDays(mealLogs.map((m) => m.date));
          const totalCalories = sum(mealLogs.map((m) => m.estimatedCalories));
          return {
            loggedMeals: mealLogs.length,
            loggedDays,
            totalCalories: round0(totalCalories),
            avgCaloriesPerLoggedDay: round0(totalCalories / loggedDays),
            avgProteinG: round0(average(mealLogs.map((m) => m.proteinG))),
            avgCarbsG: round0(average(mealLogs.map((m) => m.carbsG))),
            avgFatG: round0(average(mealLogs.map((m) => m.fatG))),
          };
        })()
      : null;

  const water =
    waterLogs.length > 0
      ? (() => {
          const loggedDays = countDistinctDays(waterLogs.map((w) => w.date));
          const totalMl = sum(waterLogs.map((w) => w.amountMl));
          return {
            loggedDays,
            totalMl,
            avgMlPerLoggedDay: round0(totalMl / loggedDays),
          };
        })()
      : null;

  const sleep =
    sleepLogs.length > 0
      ? {
          loggedNights: sleepLogs.length,
          avgHours: round1(average(sleepLogs.map((s) => s.durationHours))),
          qualityBreakdown: {
            good: sleepLogs.filter((s) => s.quality === "good").length,
            ok: sleepLogs.filter((s) => s.quality === "ok").length,
            poor: sleepLogs.filter((s) => s.quality === "poor").length,
          },
        }
      : null;

  let trainingDaysCompleted = 0;
  let totalExercises = 0;
  let totalSets = 0;

  for (const plan of workoutPlans) {
    for (const day of plan.days) {
      if (day.isRestDay || !day.completedAt) continue;
      const dayDate = new Date(plan.weekStart);
      dayDate.setDate(dayDate.getDate() + day.dayIndex);
      if (dayDate >= start && dayDate < end) {
        trainingDaysCompleted += 1;
        totalExercises += day.exercises.length;
        totalSets += day.exercises.reduce((s, e) => s + e.sets, 0);
      }
    }
  }

  const exercise =
    trainingDaysCompleted > 0 ? { trainingDaysCompleted, totalExercises, totalSets } : null;

  return {
    range,
    start: start.toISOString(),
    end: end.toISOString(),
    weight,
    exercise,
    food,
    water,
    sleep,
  };
}
