import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openaiFitness } from "@/lib/openai-fitness";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getDayRange } from "@/lib/dateRange";
import {
  FITNESS_GENDERS,
  FITNESS_ACTIVITY_LEVELS,
  FITNESS_GOAL_TYPES,
  FITNESS_ENVIRONMENTS,
} from "@/models/fitness/FitnessProfile";

const ProfileInput = z
  .object({
    gender: z.enum(FITNESS_GENDERS),
    birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
    heightCm: z.number().positive(),
    weightKg: z.number().positive(),
    activityLevel: z.enum(FITNESS_ACTIVITY_LEVELS),
    goalType: z.enum(FITNESS_GOAL_TYPES),
    goalText: z.string().trim().max(500).optional(),
    targetWeightKg: z.number().positive().optional(),
    targetTimeframeWeeks: z.number().int().positive(),
    workoutFrequencyPerWeek: z.number().int().min(0).max(14),
    environment: z.enum(FITNESS_ENVIRONMENTS),
    dietaryNotes: z.string().trim().max(500).optional(),
    freeTextNote: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.goalType !== "custom" || Boolean(data.goalText), {
    message: "選擇「自訂目標」時 goalText 為必填",
    path: ["goalText"],
  });

const AiAnalysisSchema = z.object({
  bmr: z.number(),
  tdee: z.number(),
  recommendedDailyCalories: z.number(),
  summary: z.string(),
  recommendations: z.array(z.string()),
});

const ACTIVITY_LABELS: Record<(typeof FITNESS_ACTIVITY_LEVELS)[number], string> = {
  sedentary: "久坐（幾乎不運動，辦公室工作）",
  light: "輕度活動（每週輕度運動 1-3 天）",
  moderate: "中度活動（每週中度運動 3-5 天）",
  active: "高度活動（每週高強度運動 6-7 天）",
  very_active: "非常高度活動（勞力工作或每天高強度訓練）",
};

const GOAL_LABELS: Record<(typeof FITNESS_GOAL_TYPES)[number], string> = {
  lose_weight: "減重",
  gain_weight: "增重／增肌",
  maintain: "維持現狀",
  body_recomposition: "身材重塑（體態雕塑）",
  custom: "自訂目標",
};

function describeProfile(input: z.infer<typeof ProfileInput>) {
  const age = new Date().getFullYear() - input.birthYear;
  const lines = [
    `性別：${input.gender === "male" ? "男" : input.gender === "female" ? "女" : "其他"}`,
    `年齡：約 ${age} 歲`,
    `身高：${input.heightCm} cm`,
    `體重：${input.weightKg} kg`,
    `活動量：${ACTIVITY_LABELS[input.activityLevel]}`,
    `目標類型：${GOAL_LABELS[input.goalType]}`,
    input.goalText ? `目標說明（使用者原話）：${input.goalText}` : null,
    input.targetWeightKg ? `目標體重：${input.targetWeightKg} kg` : null,
    `期望達成時間：${input.targetTimeframeWeeks} 週`,
    `每週訓練頻率：${input.workoutFrequencyPerWeek} 天`,
    `訓練環境：${
      input.environment === "gym" ? "健身房" : input.environment === "home" ? "居家" : "無器材"
    }`,
    input.dietaryNotes ? `飲食備註：${input.dietaryNotes}` : null,
    input.freeTextNote ? `使用者補充說明：${input.freeTextNote}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { FitnessProfile } = await getFitnessModels();
  const profile = await FitnessProfile.findOne({ userId: session.userId });

  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ProfileInput.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "輸入資料有誤", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const description = describeProfile(input);

  const response = await openaiFitness.responses.parse({
    model: "gpt-4o-mini",
    instructions: `你是專業的健身教練與營養師，請根據使用者提供的個人資料計算基礎代謝率（BMR，使用 Mifflin-St Jeor 公式）與每日總消耗熱量（TDEE，依活動量套用對應係數），並依照使用者的目標（減重/增重/維持/身材重塑，或自訂目標文字）給出建議的每日攝取熱量、一段簡短摘要（summary，2-3 句話，使用繁體中文），以及 3-5 條具體可執行的建議（recommendations，每條一句話，涵蓋訓練與飲食面向，使用繁體中文）。如果使用者填寫了自訂目標文字或補充說明，請務必納入考量並呼應在摘要與建議中。`,
    input: description,
    text: { format: zodTextFormat(AiAnalysisSchema, "fitness_analysis") },
  });

  const analysis = response.output_parsed;

  if (!analysis) {
    return NextResponse.json({ error: "AI 分析失敗，請重新輸入" }, { status: 502 });
  }

  const { FitnessProfile, WeightLog } = await getFitnessModels();

  const profile = await FitnessProfile.findOneAndUpdate(
    { userId: session.userId },
    {
      userId: session.userId,
      ...input,
      aiAnalysis: { ...analysis, analyzedAt: new Date() },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const { start: startOfToday, end: endOfToday } = getDayRange(new Date());

  await WeightLog.findOneAndUpdate(
    { userId: session.userId, date: { $gte: startOfToday, $lt: endOfToday } },
    { userId: session.userId, date: new Date(), weightKg: input.weightKg },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return NextResponse.json({ profile, analysis });
}
