"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FitnessBackButton from "@/components/fitness/BackButton";

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

const QUICK_ADD_ML = [200, 350, 500];

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

      const [waterRes, sleepRes] = await Promise.all([
        fetch("/api/fitness/water"),
        fetch("/api/fitness/sleep"),
      ]);
      const waterData = await waterRes.json();
      const sleepData = await sleepRes.json();
      if (cancelled) return;

      setWaterEntries(waterData.entries ?? []);
      setWaterTotal(waterData.totalMl ?? 0);
      setSleepEntry(sleepData.entry);
      if (!sleepData.entry) {
        setEditingSleep(true);
      } else {
        setSleepHours(String(sleepData.entry.durationHours));
        setSleepQuality(sleepData.entry.quality);
      }
      setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
    </div>
  );
}
