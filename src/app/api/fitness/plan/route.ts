import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openaiFitness } from "@/lib/openai-fitness";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getWeekStart } from "@/lib/fitnessWeek";
import { resolveDate } from "@/lib/dateRange";

// OpenAI structured outputs require every field to be present; optional fields
// must be modeled as nullable rather than .optional() (all fields required).
const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().int().positive(),
  reps: z.string(),
  restSeconds: z.number().int().positive().nullable(),
  notes: z.string().nullable(),
});

const DayPlanSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  label: z.string(),
  isRestDay: z.boolean(),
  exercises: z.array(ExerciseSchema),
});

const WorkoutPlanAnalysis = z.object({
  weekSummary: z.string(),
  days: z.array(DayPlanSchema).length(7),
});

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "久坐（幾乎不運動）",
  light: "輕度活動",
  moderate: "中度活動",
  active: "高度活動",
  very_active: "非常高度活動",
};

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "減重",
  gain_weight: "增重／增肌",
  maintain: "維持現狀",
  body_recomposition: "身材重塑",
  custom: "自訂目標",
};

const ENVIRONMENT_LABELS: Record<string, string> = {
  gym: "健身房（有完整器材）",
  home: "居家（可能只有簡易器材或徒手）",
  none: "無固定器材，以徒手訓練為主",
};

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const refDate = resolveDate(searchParams.get("date"));

  const { WorkoutPlan } = await getFitnessModels();
  const weekStart = getWeekStart(refDate);
  const plan = await WorkoutPlan.findOne({ userId: session.userId, weekStart });

  return NextResponse.json({ plan });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const { FitnessProfile, WorkoutPlan } = await getFitnessModels();
  const profile = await FitnessProfile.findOne({ userId: session.userId });

  if (!profile) {
    return NextResponse.json({ error: "請先完成健身資料填寫" }, { status: 400 });
  }

  const weekStart = getWeekStart(new Date());

  if (!force) {
    const existing = await WorkoutPlan.findOne({ userId: session.userId, weekStart });
    if (existing) {
      return NextResponse.json({ plan: existing });
    }
  }

  const age = new Date().getFullYear() - profile.birthYear;
  const description = [
    `性別：${profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "其他"}`,
    `年齡：約 ${age} 歲`,
    `身高：${profile.heightCm} cm`,
    `體重：${profile.weightKg} kg`,
    profile.targetWeightKg ? `目標體重：${profile.targetWeightKg} kg` : null,
    `活動量：${ACTIVITY_LABELS[profile.activityLevel]}`,
    `目標：${GOAL_LABELS[profile.goalType]}`,
    profile.goalText ? `目標補充說明：${profile.goalText}` : null,
    `訓練環境：${ENVIRONMENT_LABELS[profile.environment]}`,
    `每週希望訓練天數：${profile.workoutFrequencyPerWeek} 天`,
    profile.freeTextNote ? `使用者補充說明（可能包含傷病史等限制，務必納入考量）：${profile.freeTextNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openaiFitness.responses.parse({
    model: "gpt-4o-mini",
    instructions: `你是專業的健身教練，請根據使用者的個人資料排出「一週」訓練計畫（週一到週日共 7 天，dayIndex 0=週一 ... 6=週日）。

規則：
- 訓練天數必須剛好等於使用者「每週希望訓練天數」，其餘天數 isRestDay 設為 true 且 exercises 為空陣列，label 請填類似「休息日」。
- 訓練日的動作要符合使用者的訓練環境（健身房/居家/無器材），不可以排需要器材但使用者環境沒有的動作。
- 如果使用者補充說明中提到傷病、疼痛或身體限制，訓練內容必須避開會加重該部位負擔的動作，並可在該動作的 notes 欄位提醒替代做法。
- 每個訓練日的 label 請簡短描述當天訓練重點（例如「上肢推力訓練」），並依照使用者目標（減重/增肌/維持/身材重塑）安排合理的訓練分項與強度。
- exercises 的 reps 欄位可以是範圍字串（如 "8-12"）或時間（如 "30 秒"）。restSeconds 或 notes 沒有內容時請填 null，不要省略欄位。
- weekSummary 請用 2-3 句繁體中文，說明這週安排的整體邏輯與需注意的事項。
- 全部文字使用繁體中文。`,
    input: description,
    text: { format: zodTextFormat(WorkoutPlanAnalysis, "workout_plan") },
  });

  const analysis = response.output_parsed;

  if (!analysis) {
    return NextResponse.json({ error: "AI 訓練計畫產生失敗，請稍後再試" }, { status: 502 });
  }

  const plan = await WorkoutPlan.findOneAndUpdate(
    { userId: session.userId, weekStart },
    {
      userId: session.userId,
      weekStart,
      weekSummary: analysis.weekSummary,
      days: analysis.days
        .slice()
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map((d) => ({ ...d, completedAt: null })),
      basedOnWeightKg: profile.weightKg,
      generatedAt: new Date(),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return NextResponse.json({ plan });
}
