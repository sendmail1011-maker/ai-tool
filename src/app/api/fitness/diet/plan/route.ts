import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openaiFitness } from "@/lib/openai-fitness";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const MealGuidanceItem = z.object({
  meal: z.string(),
  suggestion: z.string(),
});

const DietPlanAnalysis = z.object({
  dailyCalories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  mealGuidance: z.array(MealGuidanceItem),
  avoid: z.array(z.string()),
  summary: z.string(),
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

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { DietPlan } = await getFitnessModels();
  const plan = await DietPlan.findOne({ userId: session.userId });

  return NextResponse.json({ plan });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { FitnessProfile, DietPlan } = await getFitnessModels();
  const profile = await FitnessProfile.findOne({ userId: session.userId });

  if (!profile) {
    return NextResponse.json({ error: "請先完成健身資料填寫" }, { status: 400 });
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
    profile.aiAnalysis?.tdee ? `每日總消耗熱量（TDEE）：約 ${Math.round(profile.aiAnalysis.tdee)} 大卡` : null,
    profile.dietaryNotes ? `飲食備註（過敏、素食等，務必遵守）：${profile.dietaryNotes}` : null,
    profile.freeTextNote ? `使用者補充說明：${profile.freeTextNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openaiFitness.responses.parse({
    model: "gpt-4o-mini",
    instructions: `你是專業營養師，請根據使用者的個人資料與目標，給出飲食建議（不需要具體菜單，只需要方向性建議）。

規則：
- dailyCalories 請依 TDEE 與使用者目標（減重/增重/維持/身材重塑）調整（減重通常低於 TDEE、增重通常高於 TDEE）。
- proteinG/carbsG/fatG 為每日建議攝取克數，三者熱量總和應大致等於 dailyCalories（蛋白質與碳水each 4大卡/克，脂肪 9大卡/克）。
- mealGuidance 請針對「早餐」「午餐」「晚餐」「點心」各給一則方向性建議（不用列出精確菜色，例如「以優質蛋白質＋蔬菜為主，搭配一份全穀類」）。
- avoid 請列出 2-4 項使用者應避免或減少的飲食習慣或食物類型，務必考慮飲食備註中的過敏或飲食限制。
- summary 請用 2-3 句繁體中文說明整體飲食方向與需注意的事項。
- 全部文字使用繁體中文。`,
    input: description,
    text: { format: zodTextFormat(DietPlanAnalysis, "diet_plan") },
  });

  const analysis = response.output_parsed;

  if (!analysis) {
    return NextResponse.json({ error: "AI 飲食建議產生失敗，請稍後再試" }, { status: 502 });
  }

  const plan = await DietPlan.findOneAndUpdate(
    { userId: session.userId },
    {
      userId: session.userId,
      ...analysis,
      basedOnWeightKg: profile.weightKg,
      generatedAt: new Date(),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return NextResponse.json({ plan });
}
