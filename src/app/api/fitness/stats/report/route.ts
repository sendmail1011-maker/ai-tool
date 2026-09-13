import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openaiFitness } from "@/lib/openai-fitness";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { computeFitnessStats, type StatsRange } from "@/lib/fitnessStats";

const StatsReportAnalysis = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  adjustments: z.array(z.string()),
});

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "減重",
  gain_weight: "增重／增肌",
  maintain: "維持現狀",
  body_recomposition: "身材重塑",
  custom: "自訂目標",
};

const RANGE_LABELS: Record<StatsRange, string> = { day: "當天", month: "本月", year: "今年" };

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const range: StatsRange = body?.range === "month" || body?.range === "year" ? body.range : "day";
  const dateParam = typeof body?.date === "string" ? body.date : null;
  const refDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T00:00:00`) : new Date();

  const { FitnessProfile } = await getFitnessModels();
  const profile = await FitnessProfile.findOne({ userId: session.userId });

  if (!profile) {
    return NextResponse.json({ error: "請先完成健身資料填寫" }, { status: 400 });
  }

  const stats = await computeFitnessStats(session.userId, range, refDate);

  if (!stats.weight && !stats.exercise && !stats.food && !stats.water && !stats.sleep) {
    return NextResponse.json({ error: "這段期間還沒有任何紀錄，無法產生報告" }, { status: 400 });
  }

  const lines = [
    `使用者目標：${GOAL_LABELS[profile.goalType] ?? profile.goalType}${
      profile.goalText ? `（${profile.goalText}）` : ""
    }`,
    profile.targetWeightKg ? `目標體重：${profile.targetWeightKg} kg` : null,
    `統計範圍：${RANGE_LABELS[range]}`,
    stats.weight
      ? `體重：平均 ${stats.weight.avgKg}kg，從 ${stats.weight.firstKg}kg 變化到 ${stats.weight.latestKg}kg（${
          stats.weight.changeKg >= 0 ? "+" : ""
        }${stats.weight.changeKg}kg）`
      : "體重：這段期間沒有紀錄",
    stats.exercise
      ? `運動：完成 ${stats.exercise.trainingDaysCompleted} 天訓練，共 ${stats.exercise.totalExercises} 個動作、${stats.exercise.totalSets} 組`
      : "運動：這段期間沒有打卡完成的訓練紀錄",
    stats.food
      ? `飲食：記錄了 ${stats.food.loggedDays} 天、共 ${stats.food.loggedMeals} 餐，平均每天攝取 ${stats.food.avgCaloriesPerLoggedDay} 大卡（蛋白質 ${stats.food.avgProteinG}g／碳水 ${stats.food.avgCarbsG}g／脂肪 ${stats.food.avgFatG}g）`
      : "飲食：這段期間沒有紀錄",
    stats.water
      ? `飲水：記錄了 ${stats.water.loggedDays} 天，平均每天 ${stats.water.avgMlPerLoggedDay}ml`
      : "飲水：這段期間沒有紀錄",
    stats.sleep
      ? `睡眠：記錄了 ${stats.sleep.loggedNights} 晚，平均 ${stats.sleep.avgHours} 小時，品質分佈為很好 ${stats.sleep.qualityBreakdown.good}、普通 ${stats.sleep.qualityBreakdown.ok}、不好 ${stats.sleep.qualityBreakdown.poor}`
      : "睡眠：這段期間沒有紀錄",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openaiFitness.responses.parse({
    model: "gpt-4o-mini",
    instructions: `你是專業的健身教練與營養師，請根據使用者這段期間的統計數字，評估目前的狀況並給出可以調整的地方，幫助使用者朝目標前進。

規則：
- 「這段期間沒有紀錄」代表使用者沒有記錄該項目，不代表數值是 0，請不要因此給負面評價，最多溫和鼓勵使用者開始記錄，不要當作缺點強調。
- summary 請用 2-3 句繁體中文，整體評估目前狀況與目標的關係。
- highlights 請列出 1-3 項做得不錯、值得繼續保持的地方（只根據有資料的項目）。
- adjustments 請列出 2-4 項具體可執行的調整建議（只根據有資料的項目，不要對沒有資料的項目做假設性建議）。
- 全部使用繁體中文，語氣鼓勵但務實。`,
    input: lines,
    text: { format: zodTextFormat(StatsReportAnalysis, "stats_report") },
  });

  const analysis = response.output_parsed;

  if (!analysis) {
    return NextResponse.json({ error: "AI 報告產生失敗，請稍後再試" }, { status: 502 });
  }

  return NextResponse.json({ report: analysis, stats });
}
