"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FitnessBackButton from "@/components/fitness/BackButton";

type Exercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string | null;
};

type Day = {
  dayIndex: number;
  label: string;
  isRestDay: boolean;
  exercises: Exercise[];
  completedAt: string | null;
};

type Plan = {
  _id: string;
  weekStart: string;
  weekSummary: string;
  days: Day[];
};

const DAY_NAMES = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

export default function FitnessPlanPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingDay, setTogglingDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);

      const res = await fetch("/api/fitness/plan");
      const data = await res.json();
      if (!cancelled) {
        setPlan(data.plan);
        setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleGenerate(force: boolean) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/fitness/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "產生失敗");
        return;
      }
      setPlan(data.plan);
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleDay(dayIndex: number, completed: boolean) {
    if (!plan) return;
    setTogglingDay(dayIndex);
    try {
      const res = await fetch("/api/fitness/plan/day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan._id, dayIndex, completed }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlan(data.plan);
      }
    } finally {
      setTogglingDay(null);
    }
  }

  if (checkingAuth || loading) {
    return null;
  }

  return (
    <div className="flex-1 bg-background px-5 py-8">
      <div className="flex items-center gap-2">
        <FitnessBackButton />
        <h1 className="text-xl font-bold tracking-tight">本週訓練計畫</h1>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {!plan && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">
            這週還沒有訓練計畫，讓 AI 依你的健身資料排一份。
          </p>
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
          >
            {generating ? "AI 排課中..." : "產生本週訓練計畫"}
          </button>
        </div>
      )}

      {plan && (
        <>
          <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="text-sm font-semibold">本週重點</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{plan.weekSummary}</p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {plan.days.map((day) => (
              <div key={day.dayIndex} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {DAY_NAMES[day.dayIndex]}
                    </span>
                    <h3 className="text-sm font-semibold">{day.label}</h3>
                  </div>
                  {!day.isRestDay && (
                    <button
                      type="button"
                      onClick={() => toggleDay(day.dayIndex, !day.completedAt)}
                      disabled={togglingDay === day.dayIndex}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50 ${
                        day.completedAt
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground"
                      }`}
                    >
                      {day.completedAt ? "已完成 ✓" : "標記完成"}
                    </button>
                  )}
                </div>

                {!day.isRestDay && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {day.exercises.map((ex, i) => (
                      <li key={i} className="text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{ex.name}</span>
                          <span className="text-muted-foreground">
                            {ex.sets} 組 x {ex.reps}
                            {ex.restSeconds ? ` · 休息 ${ex.restSeconds}s` : ""}
                          </span>
                        </div>
                        {ex.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{ex.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="mt-6 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm disabled:opacity-50"
          >
            {generating ? "AI 排課中..." : "重新產生本週計畫"}
          </button>
        </>
      )}
    </div>
  );
}
