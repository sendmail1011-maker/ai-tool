import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openaiFitness } from "@/lib/openai-fitness";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const MealAnalysis = z.object({
  description: z.string(),
  estimatedCalories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  feedback: z.string(),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const imageBase64 =
    typeof body.imageBase64 === "string" && body.imageBase64.startsWith("data:image/")
      ? body.imageBase64
      : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!imageBase64) {
    return NextResponse.json({ error: "請附上一張餐點照片" }, { status: 400 });
  }

  const { DietPlan, MealLog } = await getFitnessModels();

  const [dietPlan, todaysMeals] = await Promise.all([
    DietPlan.findOne({ userId: session.userId }),
    (() => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday);
      endOfToday.setDate(endOfToday.getDate() + 1);
      return MealLog.find({
        userId: session.userId,
        date: { $gte: startOfToday, $lt: endOfToday },
      });
    })(),
  ]);

  const todaysCalories = todaysMeals.reduce((sum, m) => sum + m.estimatedCalories, 0);

  const context = [
    dietPlan
      ? `使用者每日熱量目標：${Math.round(dietPlan.dailyCalories)} 大卡（蛋白質 ${Math.round(
          dietPlan.proteinG
        )}g／碳水 ${Math.round(dietPlan.carbsG)}g／脂肪 ${Math.round(dietPlan.fatG)}g）`
      : null,
    todaysMeals.length > 0
      ? `使用者今天已經記錄了 ${todaysMeals.length} 餐，累計約 ${Math.round(todaysCalories)} 大卡`
      : "使用者今天還沒有記錄過其他餐點",
    note ? `使用者補充說明：${note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openaiFitness.responses.parse({
    model: "gpt-4o-mini",
    instructions: `你是專業營養師，請根據使用者提供的餐點照片，判斷照片中的食物內容，估算這一餐的熱量與三大營養素（蛋白質/碳水/脂肪，單位皆為克，熱量單位大卡）。

description 請簡短列出辨識出的食物項目（例如「烤雞胸肉、糙米飯、炒青菜」）。
feedback 請用 1-3 句繁體中文，依據使用者的每日熱量／營養素目標與今天累計攝取量，給出這一餐的評價與建議（例如熱量是否超標、營養是否均衡、下一餐該怎麼調整）；如果沒有目標資料可參考，就給一般性的營養建議。

以下是使用者目前的背景資訊：
${context || "（無）"}`,
    input: [
      {
        role: "user" as const,
        content: [
          { type: "input_text" as const, text: note || "請分析這張餐點照片。" },
          { type: "input_image" as const, image_url: imageBase64, detail: "auto" as const },
        ],
      },
    ],
    text: { format: zodTextFormat(MealAnalysis, "meal_analysis") },
  });

  const analysis = response.output_parsed;

  if (!analysis) {
    return NextResponse.json({ error: "AI 分析失敗，請重新嘗試" }, { status: 502 });
  }

  return NextResponse.json({ analysis });
}
