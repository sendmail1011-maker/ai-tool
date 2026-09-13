"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Gender = "male" | "female" | "other";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type GoalType = "lose_weight" | "gain_weight" | "maintain" | "body_recomposition" | "custom";
type Environment = "gym" | "home" | "none";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "久坐（幾乎不運動）" },
  { value: "light", label: "輕度活動（每週 1-3 天）" },
  { value: "moderate", label: "中度活動（每週 3-5 天）" },
  { value: "active", label: "高度活動（每週 6-7 天）" },
  { value: "very_active", label: "非常高度活動（勞力工作／每天訓練）" },
];

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "lose_weight", label: "減重" },
  { value: "gain_weight", label: "增重／增肌" },
  { value: "maintain", label: "維持現狀" },
  { value: "body_recomposition", label: "身材重塑" },
  { value: "custom", label: "自訂目標" },
];

const ENVIRONMENT_OPTIONS: { value: Environment; label: string }[] = [
  { value: "gym", label: "健身房" },
  { value: "home", label: "居家" },
  { value: "none", label: "無固定器材" },
];

type Analysis = {
  bmr: number;
  tdee: number;
  recommendedDailyCalories: number;
  summary: string;
  recommendations: string[];
};

export default function FitnessOnboardingPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [gender, setGender] = useState<Gender>("male");
  const [birthYear, setBirthYear] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");
  const [goalType, setGoalType] = useState<GoalType>("lose_weight");
  const [goalText, setGoalText] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [targetTimeframeWeeks, setTargetTimeframeWeeks] = useState("");
  const [workoutFrequencyPerWeek, setWorkoutFrequencyPerWeek] = useState("");
  const [environment, setEnvironment] = useState<Environment>("gym");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [freeTextNote, setFreeTextNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (cancelled) return;
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setCheckingAuth(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/fitness/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender,
          birthYear: Number(birthYear),
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          activityLevel,
          goalType,
          goalText: goalText.trim() || undefined,
          targetWeightKg: targetWeightKg ? Number(targetWeightKg) : undefined,
          targetTimeframeWeeks: Number(targetTimeframeWeeks),
          workoutFrequencyPerWeek: Number(workoutFrequencyPerWeek),
          environment,
          dietaryNotes: dietaryNotes.trim() || undefined,
          freeTextNote: freeTextNote.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "發生錯誤");
        return;
      }

      setAnalysis(data.analysis);
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return null;
  }

  if (analysis) {
    return (
      <div className="flex-1 bg-background px-5 py-8">
        <h1 className="text-xl font-bold tracking-tight">你的 AI 健身分析</h1>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard label="BMR" value={`${Math.round(analysis.bmr)}`} unit="kcal" />
          <StatCard label="TDEE" value={`${Math.round(analysis.tdee)}`} unit="kcal" />
          <StatCard
            label="建議攝取"
            value={`${Math.round(analysis.recommendedDailyCalories)}`}
            unit="kcal"
          />
        </div>

        <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 className="text-sm font-semibold">摘要</h2>
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

        <button
          type="button"
          onClick={() => router.push("/fitness")}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30"
        >
          前往健身首頁
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background px-5 py-8">
      <h1 className="text-xl font-bold tracking-tight">建立你的健身資料</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        填寫個人資料，AI 會依此計算建議熱量並給出訓練建議。
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <Field label="性別">
          <SegmentedControl
            value={gender}
            onChange={setGender}
            options={[
              { value: "male", label: "男" },
              { value: "female", label: "女" },
              { value: "other", label: "其他" },
            ]}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="出生年份">
            <NumberInput value={birthYear} onChange={setBirthYear} placeholder="1990" required />
          </Field>
          <Field label="身高 (cm)">
            <NumberInput value={heightCm} onChange={setHeightCm} placeholder="170" required />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="體重 (kg)">
            <NumberInput value={weightKg} onChange={setWeightKg} placeholder="65" required />
          </Field>
          <Field label="目標體重 (kg，選填)">
            <NumberInput value={targetWeightKg} onChange={setTargetWeightKg} placeholder="60" />
          </Field>
        </div>

        <Field label="工作/日常活動量">
          <Select
            value={activityLevel}
            onChange={(v) => setActivityLevel(v as ActivityLevel)}
            options={ACTIVITY_OPTIONS}
          />
        </Field>

        <Field label="目標">
          <Select
            value={goalType}
            onChange={(v) => setGoalType(v as GoalType)}
            options={GOAL_OPTIONS}
          />
        </Field>

        <Field
          label={
            goalType === "custom" ? "描述你的目標" : "補充說明你的目標（選填）"
          }
        >
          <textarea
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            required={goalType === "custom"}
            rows={2}
            placeholder="用自己的話描述想達成什麼"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="期望達成時間 (週)">
            <NumberInput
              value={targetTimeframeWeeks}
              onChange={setTargetTimeframeWeeks}
              placeholder="12"
              required
            />
          </Field>
          <Field label="每週訓練頻率 (天)">
            <NumberInput
              value={workoutFrequencyPerWeek}
              onChange={setWorkoutFrequencyPerWeek}
              placeholder="3"
              required
            />
          </Field>
        </div>

        <Field label="訓練環境">
          <Select
            value={environment}
            onChange={(v) => setEnvironment(v as Environment)}
            options={ENVIRONMENT_OPTIONS}
          />
        </Field>

        <Field label="飲食備註（選填，如過敏、素食等）">
          <textarea
            value={dietaryNotes}
            onChange={(e) => setDietaryNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        <Field label="其他補充（選填）">
          <textarea
            value={freeTextNote}
            onChange={(e) => setFreeTextNote(e.target.value)}
            rows={2}
            placeholder="任何想讓 AI 教練知道的事"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-opacity disabled:opacity-50"
        >
          {submitting ? "AI 分析中..." : "送出並取得 AI 分析"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-full bg-muted p-1 text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-full px-4 py-1.5 font-medium transition-colors ${
            value === opt.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center ring-1 ring-border">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">
        {unit} · {label}
      </div>
    </div>
  );
}
