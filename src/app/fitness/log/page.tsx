"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FitnessBackButton from "@/components/fitness/BackButton";

type WeightEntry = {
  _id: string;
  weightKg: number;
};

type WaterEntry = {
  _id: string;
  amountMl: number;
  date: string;
};

type SleepEntry = {
  _id: string;
  durationHours: number;
  quality: "good" | "ok" | "poor";
};

type StepEntry = {
  _id: string;
  steps: number;
};

type CardioActivityType = "walk" | "run" | "cycle" | "swim" | "other";

type CardioEntry = {
  _id: string;
  activityType: CardioActivityType;
  durationMinutes: number;
  distanceKm: number | null;
  estimatedCaloriesBurned: number;
  notes: string | null;
};

const QUICK_ADD_ML = [200, 350, 500];

const ACTIVITY_OPTIONS: { value: CardioActivityType; label: string }[] = [
  { value: "walk", label: "走路" },
  { value: "run", label: "跑步" },
  { value: "cycle", label: "騎車" },
  { value: "swim", label: "游泳" },
  { value: "other", label: "其他" },
];

const ACTIVITY_LABELS: Record<CardioActivityType, string> = {
  walk: "走路",
  run: "跑步",
  cycle: "騎車",
  swim: "游泳",
  other: "其他",
};

const QUALITY_OPTIONS: { value: SleepEntry["quality"]; label: string }[] = [
  { value: "good", label: "很好" },
  { value: "ok", label: "普通" },
  { value: "poor", label: "不好" },
];

const QUALITY_LABELS: Record<SleepEntry["quality"], string> = {
  good: "很好",
  ok: "普通",
  poor: "不好",
};

export default function FitnessDailyLogPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [weightEntry, setWeightEntry] = useState<WeightEntry | null>(null);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightValue, setWeightValue] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);

  const [waterTotal, setWaterTotal] = useState(0);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [customMl, setCustomMl] = useState("");
  const [addingWater, setAddingWater] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);

  const [sleepEntry, setSleepEntry] = useState<SleepEntry | null>(null);
  const [editingSleep, setEditingSleep] = useState(false);
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState<SleepEntry["quality"]>("ok");
  const [savingSleep, setSavingSleep] = useState(false);
  const [sleepError, setSleepError] = useState<string | null>(null);

  const [stepEntry, setStepEntry] = useState<StepEntry | null>(null);
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsValue, setStepsValue] = useState("");
  const [savingSteps, setSavingSteps] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const [cardioEntries, setCardioEntries] = useState<CardioEntry[]>([]);
  const [cardioType, setCardioType] = useState<CardioActivityType>("walk");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioNotes, setCardioNotes] = useState("");
  const [addingCardio, setAddingCardio] = useState(false);
  const [cardioError, setCardioError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);

      const [weightRes, waterRes, sleepRes, stepsRes, cardioRes] = await Promise.all([
        fetch("/api/fitness/weight"),
        fetch("/api/fitness/water"),
        fetch("/api/fitness/sleep"),
        fetch("/api/fitness/steps"),
        fetch("/api/fitness/cardio"),
      ]);
      const weightData = await weightRes.json();
      const waterData = await waterRes.json();
      const sleepData = await sleepRes.json();
      const stepsData = await stepsRes.json();
      const cardioData = await cardioRes.json();
      if (cancelled) return;

      setWeightEntry(weightData.entry);
      if (!weightData.entry) {
        setEditingWeight(true);
      } else {
        setWeightValue(String(weightData.entry.weightKg));
      }
      setWaterEntries(waterData.entries ?? []);
      setWaterTotal(waterData.totalMl ?? 0);
      setSleepEntry(sleepData.entry);
      if (!sleepData.entry) {
        setEditingSleep(true);
      } else {
        setSleepHours(String(sleepData.entry.durationHours));
        setSleepQuality(sleepData.entry.quality);
      }
      setStepEntry(stepsData.entry);
      if (!stepsData.entry) {
        setEditingSteps(true);
      } else {
        setStepsValue(String(stepsData.entry.steps));
      }
      setCardioEntries(cardioData.entries ?? []);
      setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function saveWeight() {
    const weightKg = Number(weightValue);
    if (!weightKg || weightKg <= 0) {
      setWeightError("請輸入有效的體重");
      return;
    }
    setSavingWeight(true);
    setWeightError(null);
    try {
      const res = await fetch("/api/fitness/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWeightError(data.error ?? "記錄失敗");
        return;
      }
      setWeightEntry(data.entry);
      setEditingWeight(false);
    } catch {
      setWeightError("連線失敗，請稍後再試");
    } finally {
      setSavingWeight(false);
    }
  }

  async function addWater(amountMl: number) {
    if (amountMl <= 0) return;
    setAddingWater(true);
    setWaterError(null);
    try {
      const res = await fetch("/api/fitness/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWaterError(data.error ?? "記錄失敗");
        return;
      }
      setWaterEntries((prev) => [...prev, data.entry]);
      setWaterTotal((prev) => prev + amountMl);
      setCustomMl("");
    } catch {
      setWaterError("連線失敗，請稍後再試");
    } finally {
      setAddingWater(false);
    }
  }

  async function saveSleep() {
    const durationHours = Number(sleepHours);
    if (!durationHours || durationHours <= 0) {
      setSleepError("請輸入有效的睡眠時數");
      return;
    }
    setSavingSleep(true);
    setSleepError(null);
    try {
      const res = await fetch("/api/fitness/sleep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationHours, quality: sleepQuality }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSleepError(data.error ?? "記錄失敗");
        return;
      }
      setSleepEntry(data.entry);
      setEditingSleep(false);
    } catch {
      setSleepError("連線失敗，請稍後再試");
    } finally {
      setSavingSleep(false);
    }
  }

  async function saveSteps() {
    const steps = Number(stepsValue);
    if (stepsValue === "" || steps < 0) {
      setStepsError("請輸入有效的步數");
      return;
    }
    setSavingSteps(true);
    setStepsError(null);
    try {
      const res = await fetch("/api/fitness/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStepsError(data.error ?? "記錄失敗");
        return;
      }
      setStepEntry(data.entry);
      setEditingSteps(false);
    } catch {
      setStepsError("連線失敗，請稍後再試");
    } finally {
      setSavingSteps(false);
    }
  }

  async function addCardio() {
    const durationMinutes = Number(cardioDuration);
    if (!durationMinutes || durationMinutes <= 0) {
      setCardioError("請輸入有效的時長");
      return;
    }
    setAddingCardio(true);
    setCardioError(null);
    try {
      const res = await fetch("/api/fitness/cardio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: cardioType,
          durationMinutes,
          distanceKm: cardioDistance ? Number(cardioDistance) : undefined,
          notes: cardioNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCardioError(data.error ?? "記錄失敗");
        return;
      }
      setCardioEntries((prev) => [...prev, data.entry]);
      setCardioDuration("");
      setCardioDistance("");
      setCardioNotes("");
    } catch {
      setCardioError("連線失敗，請稍後再試");
    } finally {
      setAddingCardio(false);
    }
  }

  if (checkingAuth || loading) {
    return null;
  }

  return (
    <div className="flex-1 bg-background px-5 py-8">
      <div className="flex items-center gap-2">
        <FitnessBackButton />
        <h1 className="text-xl font-bold tracking-tight">每日紀錄</h1>
      </div>

      <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日體重</h2>
          {weightEntry && !editingWeight && (
            <button
              type="button"
              onClick={() => setEditingWeight(true)}
              className="text-xs font-medium text-primary"
            >
              編輯
            </button>
          )}
        </div>

        {weightEntry && !editingWeight ? (
          <p className="mt-2 text-sm text-muted-foreground">{weightEntry.weightKg} kg</p>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              placeholder="今天體重是？例如 68.5"
              className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={saveWeight}
              disabled={savingWeight}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingWeight ? "儲存中..." : "儲存"}
            </button>
          </div>
        )}

        {weightError && <p className="mt-2 text-sm text-red-500">{weightError}</p>}
      </div>

      <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日飲水</h2>
          <span className="text-sm font-semibold text-primary">{waterTotal} ml</span>
        </div>

        <div className="mt-3 flex gap-2">
          {QUICK_ADD_ML.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => addWater(ml)}
              disabled={addingWater}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-medium disabled:opacity-50"
            >
              +{ml}ml
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            placeholder="自訂 ml"
            className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => addWater(Number(customMl))}
            disabled={addingWater || !customMl}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            加入
          </button>
        </div>

        {waterEntries.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            今天已記錄 {waterEntries.length} 次
          </p>
        )}

        {waterError && <p className="mt-2 text-sm text-red-500">{waterError}</p>}
      </div>

      <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日睡眠</h2>
          {sleepEntry && !editingSleep && (
            <button
              type="button"
              onClick={() => setEditingSleep(true)}
              className="text-xs font-medium text-primary"
            >
              編輯
            </button>
          )}
        </div>

        {sleepEntry && !editingSleep ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {sleepEntry.durationHours} 小時 · {QUALITY_LABELS[sleepEntry.quality]}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <input
              type="number"
              inputMode="decimal"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="睡了幾小時？例如 7.5"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-1.5">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSleepQuality(opt.value)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                    sleepQuality === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={saveSleep}
              disabled={savingSleep}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
            >
              {savingSleep ? "儲存中..." : "儲存"}
            </button>
          </div>
        )}

        {sleepError && <p className="mt-2 text-sm text-red-500">{sleepError}</p>}
      </div>

      <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日步數</h2>
          {stepEntry && !editingSteps && (
            <button
              type="button"
              onClick={() => setEditingSteps(true)}
              className="text-xs font-medium text-primary"
            >
              編輯
            </button>
          )}
        </div>

        {stepEntry && !editingSteps ? (
          <p className="mt-2 text-sm text-muted-foreground">{stepEntry.steps} 步</p>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={stepsValue}
              onChange={(e) => setStepsValue(e.target.value)}
              placeholder="今天走了幾步？"
              className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={saveSteps}
              disabled={savingSteps}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingSteps ? "儲存中..." : "儲存"}
            </button>
          </div>
        )}

        {stepsError && <p className="mt-2 text-sm text-red-500">{stepsError}</p>}
      </div>

      <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <h2 className="text-sm font-semibold">有氧運動</h2>

        {cardioEntries.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {cardioEntries.map((c) => (
              <li key={c._id} className="text-sm">
                <div className="flex justify-between">
                  <span>
                    {ACTIVITY_LABELS[c.activityType]} · {c.durationMinutes} 分鐘
                    {c.distanceKm ? ` · ${c.distanceKm} km` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    約 {c.estimatedCaloriesBurned} kcal
                  </span>
                </div>
                {c.notes && <p className="mt-0.5 text-xs text-muted-foreground">{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex gap-1.5">
          {ACTIVITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCardioType(opt.value)}
              className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                cardioType === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground ring-1 ring-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={cardioDuration}
            onChange={(e) => setCardioDuration(e.target.value)}
            placeholder="時長（分鐘）"
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="number"
            inputMode="decimal"
            value={cardioDistance}
            onChange={(e) => setCardioDistance(e.target.value)}
            placeholder="距離（公里，選填）"
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <input
          type="text"
          value={cardioNotes}
          onChange={(e) => setCardioNotes(e.target.value)}
          placeholder="備註（選填）"
          className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <button
          type="button"
          onClick={addCardio}
          disabled={addingCardio}
          className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
        >
          {addingCardio ? "記錄中..." : "加入紀錄"}
        </button>

        {cardioError && <p className="mt-2 text-sm text-red-500">{cardioError}</p>}
      </div>
    </div>
  );
}
