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
type MonthStats = {
  weight: { avgKg: number; latestKg: number; changeKg: number } | null;
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
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "點心",
};

const QUALITY_LABELS: Record<string, string> = { good: "很好", ok: "普通", poor: "不好" };

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
  const [tab, setTab] = useState<"day" | "month">("day");

  const [dayLoading, setDayLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [waterTotalMl, setWaterTotalMl] = useState(0);
  const [sleepEntry, setSleepEntry] = useState<SleepEntry | null>(null);

  const [monthLoading, setMonthLoading] = useState(true);
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);

  const [report, setReport] = useState<{ tab: "day" | "month"; dateKey: string; data: Report } | null>(
    null
  );
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
      const [weightRes, planRes, mealsRes, waterRes, sleepRes] = await Promise.all([
        fetch(`/api/fitness/weight?date=${dateKey}`),
        fetch(`/api/fitness/plan?date=${dateKey}`),
        fetch(`/api/fitness/meal/log?date=${dateKey}`),
        fetch(`/api/fitness/water?date=${dateKey}`),
        fetch(`/api/fitness/sleep?date=${dateKey}`),
      ]);
      const [weightData, planData, mealsData, waterData, sleepData] = await Promise.all([
        weightRes.json(),
        planRes.json(),
        mealsRes.json(),
        waterRes.json(),
        sleepRes.json(),
      ]);
      if (cancelled) return;

      setWeightKg(weightData.entry?.weightKg ?? null);

      const dayIndex = getTodayDayIndex(selectedDate);
      const day = planData.plan?.days?.find((d: PlanDay) => d.dayIndex === dayIndex) ?? null;
      setPlanDay(day);

      setMeals(mealsData.meals ?? []);
      setWaterTotalMl(waterData.totalMl ?? 0);
      setSleepEntry(sleepData.entry ?? null);
      setDayLoading(false);
    }

    loadDay();
    return () => {
      cancelled = true;
    };
  }, [checkingAuth, selectedDate]);

  useEffect(() => {
    if (checkingAuth) return;
    let cancelled = false;
    const dateKey = formatDateKey(selectedDate);

    async function loadMonth() {
      setMonthLoading(true);
      const res = await fetch(`/api/fitness/stats?range=month&date=${dateKey}`);
      const data = await res.json();
      if (cancelled) return;
      setMonthStats(data);
      setMonthLoading(false);
    }

    loadMonth();
    return () => {
      cancelled = true;
    };
  }, [checkingAuth, selectedDate]);

  async function generateReport() {
    setReportLoading(true);
    setReportError(null);
    const dateKey = formatDateKey(selectedDate);
    try {
      const res = await fetch("/api/fitness/stats/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: tab === "month" ? "month" : "day", date: dateKey }),
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
  const hasAnyStatsData =
    tab === "day"
      ? weightKg !== null || planDay?.completedAt || meals.length > 0 || waterTotalMl > 0 || Boolean(sleepEntry)
      : Boolean(
          monthStats && (monthStats.weight || monthStats.exercise || monthStats.food || monthStats.water || monthStats.sleep)
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

          {!dayLoading && weightKg === null && !planDay?.completedAt && meals.length === 0 && waterTotalMl === 0 && !sleepEntry && (
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
        </div>
      )}

      {tab === "month" && (
        <div className="mt-4 flex flex-col gap-3">
          {monthLoading && <p className="text-sm text-muted-foreground">載入中...</p>}

          {!monthLoading &&
            monthStats &&
            !monthStats.weight &&
            !monthStats.exercise &&
            !monthStats.food &&
            !monthStats.water &&
            !monthStats.sleep && (
              <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground ring-1 ring-border">
                本月還沒有任何紀錄
              </p>
            )}

          {monthStats?.weight && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">體重</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                平均 {monthStats.weight.avgKg} kg · 最新 {monthStats.weight.latestKg} kg ·
                變化 {monthStats.weight.changeKg > 0 ? "+" : ""}
                {monthStats.weight.changeKg} kg
              </p>
            </div>
          )}

          {monthStats?.exercise && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">運動</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                完成 {monthStats.exercise.trainingDaysCompleted} 天訓練 · 共{" "}
                {monthStats.exercise.totalExercises} 個動作 · {monthStats.exercise.totalSets} 組
              </p>
            </div>
          )}

          {monthStats?.food && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">飲食</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                記錄 {monthStats.food.loggedDays} 天，共 {monthStats.food.loggedMeals} 餐 · 平均每天{" "}
                {monthStats.food.avgCaloriesPerLoggedDay} kcal
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                平均蛋白質 {monthStats.food.avgProteinG}g · 碳水 {monthStats.food.avgCarbsG}g · 脂肪{" "}
                {monthStats.food.avgFatG}g
              </p>
            </div>
          )}

          {monthStats?.water && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">飲水</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                記錄 {monthStats.water.loggedDays} 天 · 平均每天{" "}
                {monthStats.water.avgMlPerLoggedDay} ml · 總計 {monthStats.water.totalMl} ml
              </p>
            </div>
          )}

          {monthStats?.sleep && (
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">睡眠</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                記錄 {monthStats.sleep.loggedNights} 晚 · 平均 {monthStats.sleep.avgHours} 小時
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                品質：很好 {monthStats.sleep.qualityBreakdown.good}、普通{" "}
                {monthStats.sleep.qualityBreakdown.ok}、不好 {monthStats.sleep.qualityBreakdown.poor}
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
              {reportLoading ? "AI 分析中..." : `產生${tab === "month" ? "本月" : "當日"} AI 評估`}
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
