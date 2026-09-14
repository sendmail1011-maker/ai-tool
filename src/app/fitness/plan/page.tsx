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

const BLANK_EXERCISE: Exercise = { name: "", sets: 3, reps: "10", restSeconds: null, notes: null };

export default function FitnessPlanPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingDay, setTogglingDay] = useState<number | null>(null);

  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftIsRestDay, setDraftIsRestDay] = useState(false);
  const [draftExercises, setDraftExercises] = useState<Exercise[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null);
  const [swapTarget, setSwapTarget] = useState<number | "">("");
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

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

  function startEdit(day: Day) {
    setSwapDayIndex(null);
    setEditingDayIndex(day.dayIndex);
    setDraftLabel(day.label);
    setDraftIsRestDay(day.isRestDay);
    setDraftExercises(day.exercises.map((e) => ({ ...e })));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingDayIndex(null);
    setEditError(null);
  }

  function updateDraftExercise(i: number, patch: Partial<Exercise>) {
    setDraftExercises((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function addDraftExercise() {
    setDraftExercises((prev) => [...prev, { ...BLANK_EXERCISE }]);
  }

  function removeDraftExercise(i: number) {
    setDraftExercises((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveEdit() {
    if (!plan || editingDayIndex === null) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch("/api/fitness/plan/day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan._id,
          dayIndex: editingDayIndex,
          label: draftLabel.trim() || "訓練",
          isRestDay: draftIsRestDay,
          exercises: draftIsRestDay
            ? []
            : draftExercises.map((e) => ({
                name: e.name.trim(),
                sets: Number(e.sets) || 1,
                reps: e.reps.trim() || "1",
                restSeconds: e.restSeconds ? Number(e.restSeconds) : null,
                notes: e.notes?.trim() || null,
              })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "儲存失敗");
        return;
      }
      setPlan(data.plan);
      setEditingDayIndex(null);
    } catch {
      setEditError("連線失敗，請稍後再試");
    } finally {
      setSavingEdit(false);
    }
  }

  function startSwap(dayIndex: number) {
    setEditingDayIndex(null);
    setSwapDayIndex(dayIndex);
    setSwapTarget("");
    setSwapError(null);
  }

  async function confirmSwap(dayIndexA: number) {
    if (!plan || swapTarget === "") return;
    setSwapping(true);
    setSwapError(null);
    try {
      const res = await fetch("/api/fitness/plan/day/swap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan._id, dayIndexA, dayIndexB: swapTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSwapError(data.error ?? "對調失敗");
        return;
      }
      setPlan(data.plan);
      setSwapDayIndex(null);
      setSwapTarget("");
    } catch {
      setSwapError("連線失敗，請稍後再試");
    } finally {
      setSwapping(false);
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
            {plan.days.map((day) => {
              const isEditing = editingDayIndex === day.dayIndex;
              const isSwapping = swapDayIndex === day.dayIndex;

              return (
                <div key={day.dayIndex} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {DAY_NAMES[day.dayIndex]}
                      </span>
                      {!isEditing && <h3 className="text-sm font-semibold">{day.label}</h3>}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1.5">
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
                        <button
                          type="button"
                          onClick={() => startSwap(day.dayIndex)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          對調
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(day)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          編輯
                        </button>
                      </div>
                    )}
                  </div>

                  {isSwapping && (
                    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        把「{day.label}」跟哪一天對調？（打卡狀態會跟著內容一起換）
                      </p>
                      <select
                        value={swapTarget}
                        onChange={(e) =>
                          setSwapTarget(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="">選擇日期</option>
                        {plan.days
                          .filter((d) => d.dayIndex !== day.dayIndex)
                          .map((d) => (
                            <option key={d.dayIndex} value={d.dayIndex}>
                              {DAY_NAMES[d.dayIndex]} · {d.isRestDay ? "休息日" : d.label}
                            </option>
                          ))}
                      </select>
                      {swapError && <p className="text-xs text-red-500">{swapError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSwapDayIndex(null)}
                          className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmSwap(day.dayIndex)}
                          disabled={swapTarget === "" || swapping}
                          className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {swapping ? "處理中..." : "確認對調"}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isEditing && !day.isRestDay && (
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

                  {isEditing && (
                    <div className="mt-3 flex flex-col gap-3">
                      <input
                        type="text"
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        placeholder="這天的標題"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draftIsRestDay}
                          onChange={(e) => setDraftIsRestDay(e.target.checked)}
                        />
                        設為休息日
                      </label>

                      {!draftIsRestDay && (
                        <div className="flex flex-col gap-3">
                          {draftExercises.map((ex, i) => (
                            <div key={i} className="rounded-lg bg-muted/50 p-2.5">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={ex.name}
                                  onChange={(e) => updateDraftExercise(i, { name: e.target.value })}
                                  placeholder="動作名稱"
                                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeDraftExercise(i)}
                                  aria-label="刪除動作"
                                  className="shrink-0 text-muted-foreground"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={ex.sets}
                                  onChange={(e) =>
                                    updateDraftExercise(i, { sets: Number(e.target.value) })
                                  }
                                  placeholder="組數"
                                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                                />
                                <input
                                  type="text"
                                  value={ex.reps}
                                  onChange={(e) => updateDraftExercise(i, { reps: e.target.value })}
                                  placeholder="次數"
                                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                                />
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={ex.restSeconds ?? ""}
                                  onChange={(e) =>
                                    updateDraftExercise(i, {
                                      restSeconds: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                  placeholder="休息(秒)"
                                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                                />
                              </div>
                              <input
                                type="text"
                                value={ex.notes ?? ""}
                                onChange={(e) =>
                                  updateDraftExercise(i, { notes: e.target.value || null })
                                }
                                placeholder="備註（選填）"
                                className="mt-1.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                              />
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={addDraftExercise}
                            className="rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground"
                          >
                            + 新增動作
                          </button>
                        </div>
                      )}

                      {editError && <p className="text-sm text-red-500">{editError}</p>}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={savingEdit}
                          className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {savingEdit ? "儲存中..." : "儲存"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
