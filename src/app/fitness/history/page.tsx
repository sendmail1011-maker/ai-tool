"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTodayDayIndex, getWeekStart } from "@/lib/fitnessWeek";
import FitnessBackButton from "@/components/fitness/BackButton";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

// The fixed Monday-to-Sunday week containing `date`.
function getWeekDates(date: Date): Date[] {
  const start = getWeekStart(date);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

type Exercise = { name: string; sets: number; reps: string; restSeconds: number | null; notes: string | null };
type PlanDay = {
  dayIndex: number;
  label: string;
  isRestDay: boolean;
  exercises: Exercise[];
  completedAt: string | null;
};
type MealEntry = {
  _id: string;
  mealType: string;
  description: string;
  estimatedCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};
type SleepEntry = { durationHours: number; quality: "good" | "ok" | "poor" };
type StepEntry = { steps: number };
type CardioEntry = {
  _id: string;
  activityType: "walk" | "run" | "cycle" | "swim" | "other";
  durationMinutes: number;
  distanceKm: number | null;
  estimatedCaloriesBurned: number;
  notes: string | null;
};
type PeriodStats = {
  weight: {
    source: "logs" | "profile";
    avgKg: number;
    latestKg: number;
    changeKg: number;
  } | null;
  exercise: { trainingDaysCompleted: number; totalExercises: number; totalSets: number } | null;
  food: {
    loggedMeals: number;
    loggedDays: number;
    totalCalories: number;
    avgCaloriesPerLoggedDay: number;
    avgProteinG: number;
    avgCarbsG: number;
    avgFatG: number;
  } | null;
  water: { loggedDays: number; totalMl: number; avgMlPerLoggedDay: number } | null;
  sleep: {
    loggedNights: number;
    avgHours: number;
    qualityBreakdown: { good: number; ok: number; poor: number };
  } | null;
  cardio: {
    sessions: number;
    totalDurationMinutes: number;
    totalDistanceKm: number | null;
    totalCaloriesBurned: number;
  } | null;
  steps: { loggedDays: number; avgSteps: number; totalSteps: number } | null;
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "點心",
};

const QUALITY_LABELS: Record<string, string> = { good: "很好", ok: "普通", poor: "不好" };

const ACTIVITY_LABELS: Record<CardioEntry["activityType"], string> = {
  walk: "走路",
  run: "跑步",
  cycle: "騎車",
  swim: "游泳",
  other: "其他",
};

type Report = { summary: string; highlights: string[]; adjustments: string[] };

export default function FitnessHistoryPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const [tab, setTab] = useState<"day" | "week" | "month">("day");

  const [dayLoading, setDayLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [waterTotalMl, setWaterTotalMl] = useState(0);
  const [sleepEntry, setSleepEntry] = useState<SleepEntry | null>(null);
  const [stepEntry, setStepEntry] = useState<StepEntry | null>(null);
  const [cardioEntries, setCardioEntries] = useState<CardioEntry[]>([]);

  const [periodLoading, setPeriodLoading] = useState(true);
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);

  const [report, setReport] = useState<{
    tab: "day" | "week" | "month";
    dateKey: string;
    data: Report;
  } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
    });
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    let cancelled = false;
    const dateKey = formatDateKey(selectedDate);

    async function loadDay() {
      setDayLoading(true);
      const [weightRes, planRes, mealsRes, waterRes, sleepRes, stepsRes, cardioRes] = await Promise.all([
        fetch(`/api/fitness/weight?date=${dateKey}`),
        fetch(`/api/fitness/plan?date=${dateKey}`),
        fetch(`/api/fitness/meal/log?date=${dateKey}`),
        fetch(`/api/fitness/water?date=${dateKey}`),
        fetch(`/api/fitness/sleep?date=${dateKey}`),
        fetch(`/api/fitness/steps?date=${dateKey}`),
        fetch(`/api/fitness/cardio?date=${dateKey}`),
      ]);
      const [weightData, planData, mealsData, waterData, sleepData, stepsData, cardioData] = await Promise.all([
        weightRes.json(),
        planRes.json(),
        mealsRes.json(),
        waterRes.json(),
        sleepRes.json(),
        stepsRes.json(),
        cardioRes.json(),
      ]);
      if (cancelled) return;

      setWeightKg(weightData.entry?.weightKg ?? null);

      const dayIndex = getTodayDayIndex(selectedDate);
      const day = planData.plan?.days?.find((d: PlanDay) => d.dayIndex === dayIndex) ?? null;
      setPlanDay(day);

      setMeals(mealsData.meals ?? []);
      setWaterTotalMl(waterData.totalMl ?? 0);
      setSleepEntry(sleepData.entry ?? null);
      setStepEntry(stepsData.entry ?? null);
      setCardioEntries(cardioData.entries ?? []);
      setDayLoading(false);
    }

    loadDay();
    return () => {
      cancelled = true;
    };
  }, [checkingAuth, selectedDate]);

  useEffect(() => {
    if (checkingAuth || tab === "day") return;
    let cancelled = false;
    const dateKey = formatDateKey(selectedDate);

    async function loadPeriod() {
      setPeriodLoading(true);
      const res = await fetch(`/api/fitness/stats?range=${tab}&date=${dateKey}`);
      const data = await res.json();
      if (cancelled) return;
      setPeriodStats(data);
      setPeriodLoading(false);
    }

    loadPeriod();
    return () => {
      cancelled = true;
    };
  }, [checkingAuth, selectedDate, tab]);

  async function generateReport() {
    setReportLoading(true);
    setReportError(null);
    const dateKey = formatDateKey(selectedDate);
    try {
      const res = await fetch("/api/fitness/stats/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: tab, date: dateKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReportError(data.error ?? "產生失敗");
        return;
      }
      setReport({ tab, dateKey, data: data.report });
    } catch {
      setReportError("連線失敗，請稍後再試");
    } finally {
      setReportLoading(false);
    }
  }

  if (checkingAuth) {
    return null;
  }

  const dateKey = formatDateKey(selectedDate);
  const currentReport = report && report.tab === tab && report.dateKey === dateKey ? report.data : null;
  const todaysCalories = meals.reduce((sum, m) => sum + m.estimatedCalories, 0);
  // A profile-fallback weight (no logs this period) doesn't count as "having
  // data" by itself — it's just a reference value, not tracked activity.
  const hasAnyStatsData =
    tab === "day"
      ? weightKg !== null ||
        planDay?.completedAt ||
        meals.length > 0 ||
        waterTotalMl > 0 ||
        Boolean(sleepEntry) ||
        Boolean(stepEntry) ||
        cardioEntries.length > 0
      : Boolean(
          periodStats &&
            (periodStats.exercise ||
              periodStats.food ||
              periodStats.water ||
              periodStats.sleep ||
              periodStats.cardio ||
              periodStats.steps)
        );

  return (
    <div className="flex-1 bg-background px-5 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FitnessBackButton />
          <h1 className="text-xl font-bold tracking-tight">歷史紀錄</h1>
        </div>
        <input
          type="date"
          value={formatDateKey(selectedDate)}
          onChange={(e) => {
            if (!e.target.value) return;
            setSelectedDate(new Date(`${e.target.value}T00:00:00`));
          }}
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
        />
      </div>

      <div className="mt-4 flex gap-1.5">
        {weekDates.map((d) => {
          const active = isSameDay(d, selectedDate);
          return (
            <button
              key={formatDateKey(d)}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`flex flex-1 flex-col items-center rounded-xl px-1 py-2 text-xs ${
                active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border"
              }`}
            >
              <span>{WEEKDAY_LABELS[d.getDay()]}</span>
              <span className="mt-0.5 text-sm font-semibold">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex rounded-full bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("day")}
          className={`flex-1 rounded-full px-4 py-1.5 font-medium transition-colors ${
            tab === "day" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          當日明細
        </button>
        <button
          type="button"
          onClick={() => setTab("week")}
          className={`flex-1 rounded-full px-4 py-1.5 font-medium transition-colors ${
            tab === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          當週總覽
        </button>
        <button
          type="button"
          onClick={() => setTab("month")}
          className={`flex-1 rounded-full px-4 py-1.5 font-medium transition-colors ${
            tab === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          本月總覽
        </button>
      </div>

      {tab === "day" && (
        <div className="mt-4 flex flex-col gap-3">
          {dayLoading && <p className="text-sm text-muted-foreground">載入中...</p>}

          {!dayLoading && !hasAnyStatsData && (
            <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground ring-1 ring-border">
              這天沒有任何紀錄
            </p>
          )}

          {weightKg !== null && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">體重</span>
                <span className="font-semibold">{weightKg} kg</span>
              </div>
            </div>
          )}

          {planDay && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {planDay.isRestDay ? "休息日" : planDay.label}
                </h2>
                {!planDay.isRestDay && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      planDay.completedAt
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {planDay.completedAt ? "已完成" : "未完成"}
                  </span>
                )}
              </div>
              {!planDay.isRestDay && (
                <ul className="mt-2 flex flex-col gap-1">
                  {planDay.exercises.map((ex, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {ex.name} · {ex.sets} 組 x {ex.reps}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {meals.length > 0 && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">飲食</h2>
                <span className="text-xs text-muted-foreground">
                  共 {Math.round(todaysCalories)} kcal
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {meals.map((m) => (
                  <li key={m._id} className="flex justify-between text-sm">
                    <span>
                      {MEAL_TYPE_LABELS[m.mealType] ?? m.mealType} · {m.description}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(m.estimatedCalories)} kcal
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {waterTotalMl > 0 && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">飲水</span>
                <span className="font-semibold">{waterTotalMl} ml</span>
              </div>
            </div>
          )}

          {sleepEntry && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">睡眠</span>
                <span className="font-semibold">
                  {sleepEntry.durationHours} 小時 · {QUALITY_LABELS[sleepEntry.quality]}
                </span>
              </div>
            </div>
          )}

          {stepEntry && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">步數</span>
                <span className="font-semibold">{stepEntry.steps} 步</span>
              </div>
            </div>
          )}

          {cardioEntries.length > 0 && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">有氧運動</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {cardioEntries.map((c) => (
                  <li key={c._id} className="flex justify-between text-sm">
                    <span>
                      {ACTIVITY_LABELS[c.activityType]} · {c.durationMinutes} 分鐘
                      {c.distanceKm ? ` · ${c.distanceKm} km` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {c.estimatedCaloriesBurned} kcal
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(tab === "week" || tab === "month") && (
        <div className="mt-4 flex flex-col gap-3">
          {periodLoading && <p className="text-sm text-muted-foreground">載入中...</p>}

          {!periodLoading && !hasAnyStatsData && (
            <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground ring-1 ring-border">
              {tab === "week" ? "本週" : "本月"}還沒有任何紀錄
            </p>
          )}

          {periodStats?.weight && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">體重</h2>
              {periodStats.weight.source === "logs" ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  平均 {periodStats.weight.avgKg} kg · 最新 {periodStats.weight.latestKg} kg ·
                  變化 {periodStats.weight.changeKg > 0 ? "+" : ""}
                  {periodStats.weight.changeKg} kg
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  這段期間沒有記錄，目前參考體重 {periodStats.weight.latestKg} kg（來自個人資料）
                </p>
              )}
            </div>
          )}

          {periodStats?.exercise && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">運動</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                完成 {periodStats.exercise.trainingDaysCompleted} 天訓練 · 共{" "}
                {periodStats.exercise.totalExercises} 個動作 · {periodStats.exercise.totalSets} 組
              </p>
            </div>
          )}

          {periodStats?.food && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">飲食</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                記錄 {periodStats.food.loggedDays} 天，共 {periodStats.food.loggedMeals} 餐 · 平均每天{" "}
                {periodStats.food.avgCaloriesPerLoggedDay} kcal
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                平均蛋白質 {periodStats.food.avgProteinG}g · 碳水 {periodStats.food.avgCarbsG}g · 脂肪{" "}
                {periodStats.food.avgFatG}g
              </p>
            </div>
          )}

          {periodStats?.water && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">飲水</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                記錄 {periodStats.water.loggedDays} 天 · 平均每天{" "}
                {periodStats.water.avgMlPerLoggedDay} ml · 總計 {periodStats.water.totalMl} ml
              </p>
            </div>
          )}

          {periodStats?.sleep && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">睡眠</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                記錄 {periodStats.sleep.loggedNights} 晚 · 平均 {periodStats.sleep.avgHours} 小時
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                品質：很好 {periodStats.sleep.qualityBreakdown.good}、普通{" "}
                {periodStats.sleep.qualityBreakdown.ok}、不好 {periodStats.sleep.qualityBreakdown.poor}
              </p>
            </div>
          )}

          {periodStats?.cardio && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">有氧運動</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                共 {periodStats.cardio.sessions} 次 · 總時長 {periodStats.cardio.totalDurationMinutes} 分鐘
                {periodStats.cardio.totalDistanceKm !== null
                  ? ` · 總距離 ${periodStats.cardio.totalDistanceKm} km`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                估計消耗 {periodStats.cardio.totalCaloriesBurned} kcal
              </p>
            </div>
          )}

          {periodStats?.steps && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">步數</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                記錄 {periodStats.steps.loggedDays} 天 · 平均每天 {periodStats.steps.avgSteps} 步 ·
                總計 {periodStats.steps.totalSteps} 步
              </p>
            </div>
          )}
        </div>
      )}

      {hasAnyStatsData && (
        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          {!currentReport && (
            <button
              type="button"
              onClick={generateReport}
              disabled={reportLoading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
            >
              {reportLoading
                ? "AI 分析中..."
                : `產生${tab === "month" ? "本月" : tab === "week" ? "本週" : "當日"} AI 評估`}
            </button>
          )}

          {reportError && <p className="mt-2 text-sm text-red-500">{reportError}</p>}

          {currentReport && (
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold">AI 評估</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{currentReport.summary}</p>
              </div>

              {currentReport.highlights.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">做得不錯</h3>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {currentReport.highlights.map((h, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentReport.adjustments.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">建議調整</h3>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {currentReport.adjustments.map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
