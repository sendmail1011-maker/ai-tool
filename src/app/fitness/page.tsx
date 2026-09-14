"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTodayDayIndex } from "@/lib/fitnessWeek";
import { getMissedMealReminder } from "@/lib/fitnessReminders";

type FitnessProfile = {
  weightKg: number;
  targetWeightKg?: number;
  targetTimeframeWeeks: number;
  goalType: string;
  goalText?: string;
  aiAnalysis?: {
    bmr: number;
    tdee: number;
    recommendedDailyCalories: number;
    summary: string;
    recommendations: string[];
  };
};

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "減重",
  gain_weight: "增重／增肌",
  maintain: "維持現狀",
  body_recomposition: "身材重塑",
  custom: "自訂目標",
};

type TodayPlanDay = {
  dayIndex: number;
  label: string;
  isRestDay: boolean;
  completedAt: string | null;
};

export default function FitnessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [todayPlanDay, setTodayPlanDay] = useState<TodayPlanDay | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [missedMeal, setMissedMeal] = useState<{ type: string; label: string } | null>(null);
  const [calorieExceeded, setCalorieExceeded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Fire every request at once (independent data, no need to wait on each
      // other) instead of chaining them — the wait becomes "the slowest one",
      // not "all of them added together".
      const [meRes, profileRes, planRes, dietPlanRes, mealsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/fitness/profile"),
        fetch("/api/fitness/plan"),
        fetch("/api/fitness/diet/plan"),
        fetch("/api/fitness/meal/log"),
      ]);

      if (!meRes.ok) {
        router.replace("/login");
        return;
      }

      const profileData = await profileRes.json();
      if (cancelled) return;

      if (!profileData.profile) {
        router.replace("/fitness/onboarding");
        return;
      }

      setProfile(profileData.profile);
      setLoading(false);

      const planData = await planRes.json();
      if (cancelled) return;

      if (planData.plan) {
        setHasPlan(true);
        const todayIndex = getTodayDayIndex(new Date());
        const today = planData.plan.days.find((d: TodayPlanDay) => d.dayIndex === todayIndex);
        setTodayPlanDay(today ?? null);
      }

      const dietPlanData = await dietPlanRes.json();
      const mealsData = await mealsRes.json();
      if (cancelled) return;

      const meals: { mealType: string; estimatedCalories: number }[] = mealsData.meals ?? [];
      setMissedMeal(
        getMissedMealReminder(
          meals.map((m) => m.mealType),
          new Date()
        )
      );

      if (dietPlanData.plan) {
        const todaysCalories = meals.reduce((sum, m) => sum + m.estimatedCalories, 0);
        setCalorieExceeded(todaysCalories >= dietPlanData.plan.dailyCalories);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading || !profile) {
    return null;
  }

  const analysis = profile.aiAnalysis;

  return (
    <div className="flex-1 bg-background px-5 py-8">
      <h1 className="text-xl font-bold tracking-tight">健身工具</h1>

      {todayPlanDay && !todayPlanDay.isRestDay && !todayPlanDay.completedAt && (
        <button
          type="button"
          onClick={() => router.push("/fitness/plan")}
          className="mt-5 flex w-full items-center justify-between rounded-2xl bg-primary/10 px-4 py-3 text-left ring-1 ring-primary/30"
        >
          <span className="text-sm font-medium text-primary">
            今天安排了「{todayPlanDay.label}」，還沒打卡完成
          </span>
          <span className="text-primary">›</span>
        </button>
      )}

      {calorieExceeded && (
        <button
          type="button"
          onClick={() => router.push("/fitness/diet")}
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-red-500/10 px-4 py-3 text-left ring-1 ring-red-500/30"
        >
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            今天攝取熱量已達到每日目標，注意份量囉
          </span>
          <span className="text-red-600 dark:text-red-400">›</span>
        </button>
      )}

      {missedMeal && (
        <button
          type="button"
          onClick={() => router.push("/fitness/diet")}
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-primary/10 px-4 py-3 text-left ring-1 ring-primary/30"
        >
          <span className="text-sm font-medium text-primary">
            已經過了{missedMeal.label}時間，還沒記錄今天吃了什麼
          </span>
          <span className="text-primary">›</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => router.push("/fitness/plan")}
        className="mt-5 flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 ring-1 ring-border"
      >
        <span className="text-sm font-medium">
          {hasPlan ? "查看本週訓練計畫" : "產生本週訓練計畫"}
        </span>
        <span className="text-muted-foreground">›</span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/fitness/diet")}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 ring-1 ring-border"
      >
        <span className="text-sm font-medium">AI 飲食建議 / 記錄餐點</span>
        <span className="text-muted-foreground">›</span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/fitness/log")}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 ring-1 ring-border"
      >
        <span className="text-sm font-medium">記錄體重 / 飲水 / 睡眠 / 步數 / 運動</span>
        <span className="text-muted-foreground">›</span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/fitness/history")}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 ring-1 ring-border"
      >
        <span className="text-sm font-medium">歷史紀錄 / 本月統計</span>
        <span className="text-muted-foreground">›</span>
      </button>

      <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">目前體重</span>
          <span className="font-semibold">{profile.weightKg} kg</span>
        </div>
        {profile.targetWeightKg && (
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">目標體重</span>
            <span className="font-semibold">{profile.targetWeightKg} kg</span>
          </div>
        )}
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">目標</span>
          <span className="font-semibold">
            {GOAL_LABELS[profile.goalType] ?? profile.goalType}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">期望達成時間</span>
          <span className="font-semibold">{profile.targetTimeframeWeeks} 週</span>
        </div>
        {profile.goalText && (
          <p className="mt-2 text-xs text-muted-foreground">「{profile.goalText}」</p>
        )}
      </div>

      {analysis && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard label="BMR" value={`${Math.round(analysis.bmr)}`} />
            <StatCard label="TDEE" value={`${Math.round(analysis.tdee)}`} />
            <StatCard label="建議攝取" value={`${Math.round(analysis.recommendedDailyCalories)}`} />
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="text-sm font-semibold">AI 摘要</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{analysis.summary}</p>
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="text-sm font-semibold">建議</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => router.push("/fitness/onboarding")}
        className="mt-6 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm"
      >
        重新填寫資料
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center ring-1 ring-border">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">kcal · {label}</div>
    </div>
  );
}
