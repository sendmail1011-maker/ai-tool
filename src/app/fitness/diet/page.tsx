"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compressImage";
import FitnessBackButton from "@/components/fitness/BackButton";

type DietPlan = {
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealGuidance: { meal: string; suggestion: string }[];
  avoid: string[];
  summary: string;
};

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type MealAnalysis = {
  description: string;
  estimatedCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  feedback: string;
};

type MealLogEntry = MealAnalysis & {
  _id: string;
  mealType: MealType;
  date: string;
};

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
  { value: "snack", label: "點心" },
];

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "點心",
};

export default function FitnessDietPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [todaysMeals, setTodaysMeals] = useState<MealLogEntry[]>([]);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [note, setNote] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [saving, setSaving] = useState(false);
  const [mealError, setMealError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);

      const [planRes, mealsRes] = await Promise.all([
        fetch("/api/fitness/diet/plan"),
        fetch("/api/fitness/meal/log"),
      ]);
      const planData = await planRes.json();
      const mealsData = await mealsRes.json();

      if (cancelled) return;
      setPlan(planData.plan);
      setTodaysMeals(mealsData.meals ?? []);
      setPlanLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleGeneratePlan() {
    setPlanGenerating(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/fitness/diet/plan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPlanError(data.error ?? "產生失敗");
        return;
      }
      setPlan(data.plan);
    } catch {
      setPlanError("連線失敗，請稍後再試");
    } finally {
      setPlanGenerating(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageProcessing(true);
    setMealError(null);
    setAnalysis(null);
    try {
      const dataUrl = await compressImage(file);
      setImagePreview(dataUrl);
    } catch {
      setMealError("圖片處理失敗，請重新選擇");
    } finally {
      setImageProcessing(false);
      e.target.value = "";
    }
  }

  async function handleAnalyze() {
    if (!imagePreview) return;
    setAnalyzing(true);
    setMealError(null);
    try {
      const res = await fetch("/api/fitness/meal/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imagePreview, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMealError(data.error ?? "分析失敗");
        return;
      }
      setAnalysis(data.analysis);
    } catch {
      setMealError("連線失敗，請稍後再試");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveMeal() {
    if (!analysis) return;
    setSaving(true);
    setMealError(null);
    try {
      const res = await fetch("/api/fitness/meal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType, ...analysis }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMealError(data.error ?? "儲存失敗");
        return;
      }
      setTodaysMeals((prev) => [...prev, data.meal]);
      setAnalysis(null);
      setImagePreview(null);
      setNote("");
    } catch {
      setMealError("連線失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  if (checkingAuth || planLoading) {
    return null;
  }

  const todaysCalories = todaysMeals.reduce((sum, m) => sum + m.estimatedCalories, 0);

  return (
    <div className="flex-1 bg-background px-5 py-8">
      <div className="flex items-center gap-2">
        <FitnessBackButton />
        <h1 className="text-xl font-bold tracking-tight">AI 飲食建議</h1>
      </div>

      {planError && <p className="mt-3 text-sm text-red-500">{planError}</p>}

      {!plan && (
        <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">
            讓 AI 依你的健身資料算出每日熱量與營養素目標。
          </p>
          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={planGenerating}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
          >
            {planGenerating ? "AI 分析中..." : "產生飲食建議"}
          </button>
        </div>
      )}

      {plan && (
        <>
          <div className="mt-5 grid grid-cols-4 gap-2">
            <StatCard label="熱量" value={`${Math.round(plan.dailyCalories)}`} unit="kcal" />
            <StatCard label="蛋白質" value={`${Math.round(plan.proteinG)}`} unit="g" />
            <StatCard label="碳水" value={`${Math.round(plan.carbsG)}`} unit="g" />
            <StatCard label="脂肪" value={`${Math.round(plan.fatG)}`} unit="g" />
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="text-sm font-semibold">摘要</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{plan.summary}</p>
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="text-sm font-semibold">每餐建議</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {plan.mealGuidance.map((g, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{g.meal}：</span>
                  <span className="text-muted-foreground">{g.suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {plan.avoid.length > 0 && (
            <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
              <h2 className="text-sm font-semibold">建議避免</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {plan.avoid.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={planGenerating}
            className="mt-3 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm disabled:opacity-50"
          >
            {planGenerating ? "AI 分析中..." : "重新產生飲食建議"}
          </button>
        </>
      )}

      <div className="mt-8 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日飲食紀錄</h2>
          <span className="text-xs text-muted-foreground">
            累計 {Math.round(todaysCalories)}
            {plan ? ` / ${Math.round(plan.dailyCalories)}` : ""} kcal
          </span>
        </div>

        {todaysMeals.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {todaysMeals.map((m) => (
              <li key={m._id} className="text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {MEAL_TYPE_LABELS[m.mealType]} · {m.description}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(m.estimatedCalories)} kcal
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <label className="mt-4 flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          📷 {imageProcessing ? "處理中..." : "拍照 / 上傳餐點照片"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            disabled={imageProcessing}
            className="hidden"
          />
        </label>

        {imagePreview && (
          <div className="mt-3 flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="餐點照片預覽"
              className="max-h-48 w-full rounded-xl object-cover"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="想補充說明的話可以打在這裡（選填）"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {!analysis && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
              >
                {analyzing ? "AI 分析中..." : "分析這餐"}
              </button>
            )}
          </div>
        )}

        {analysis && (
          <div className="mt-3 rounded-xl bg-muted/50 p-3">
            <p className="text-sm font-medium">{analysis.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              約 {Math.round(analysis.estimatedCalories)} kcal · 蛋白質{" "}
              {Math.round(analysis.proteinG)}g · 碳水 {Math.round(analysis.carbsG)}g · 脂肪{" "}
              {Math.round(analysis.fatG)}g
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{analysis.feedback}</p>

            <div className="mt-3 flex gap-1.5">
              {MEAL_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMealType(opt.value)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                    mealType === opt.value
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
              onClick={handleSaveMeal}
              disabled={saving}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
            >
              {saving ? "儲存中..." : "加入今日紀錄"}
            </button>
          </div>
        )}

        {mealError && <p className="mt-2 text-sm text-red-500">{mealError}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-card p-2.5 text-center ring-1 ring-border">
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">
        {unit} · {label}
      </div>
    </div>
  );
}
