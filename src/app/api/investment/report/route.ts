import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openaiInvestment } from "@/lib/openai-investment";
import { getInvestmentModels } from "@/lib/mongoose-investment";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { taipeiStartOfDay } from "@/lib/fitnessTimezone";
import { getInstitutionalFlowDigest, getRecentNewsForPrompt } from "@/lib/investmentReportInput";

const RecommendationSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  type: z.enum(["stock", "etf"]),
  watchReason: z.string(),
  holdingPeriod: z.string(),
  potentialUpside: z.string(),
  riskFactors: z.array(z.string()),
});

const InvestmentReportAnalysis = z.object({
  newsSummary: z.string(),
  institutionalSummary: z.string(),
  recommendations: z.array(RecommendationSchema),
});

const MAX_KEPT_REPORTS = 30;

const DISCLAIMER =
  "本報告由 AI 根據近期公開新聞與台灣證交所/櫃買中心三大法人買賣超公開資料自動彙整產生，僅為資訊整理，不構成任何投資建議、邀約或保證。所有投資均有虧損風險，過去或近期資料不代表未來表現，請自行獨立判斷並審慎評估風險，重大決策前請諮詢專業投資顧問。";

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
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);

  const { InvestmentReport } = await getInvestmentModels();
  const reports = await InvestmentReport.find()
    .sort({ reportDate: -1, generatedAt: -1 })
    .limit(limit);

  return NextResponse.json({ reports });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const [flowDigest, newsData] = await Promise.all([
    getInstitutionalFlowDigest(5),
    getRecentNewsForPrompt(5, 40),
  ]);

  if (!flowDigest && newsData.items.length === 0) {
    return NextResponse.json(
      { error: "尚無新聞或三大法人資料，請先執行資料蒐集（第2、3步的 API）" },
      { status: 400 }
    );
  }

  const newsText = newsData.items.length
    ? newsData.items
        .map(
          (n) =>
            `[${n.publishedAt}] (${n.category === "taiwan" ? "台股" : "國際"}/${n.source}) ${n.title}${
              n.summary ? `｜${n.summary}` : ""
            }`
        )
        .join("\n")
    : "（近期無蒐集到新聞資料）";

  const toYi = (amount: number) => `${(amount / 1e8).toFixed(1)}億元`;

  const flowText = flowDigest
    ? [
        `資料期間：${flowDigest.fromDate} ~ ${flowDigest.toDate}`,
        "",
        "【近5個工作天三大法人累計買賣超金額（新台幣，含上市+上櫃）】",
        flowDigest.cumulativeAmount
          ? `外資 ${toYi(flowDigest.cumulativeAmount.foreignNetAmount)}、投信 ${toYi(flowDigest.cumulativeAmount.trustNetAmount)}、自營商 ${toYi(flowDigest.cumulativeAmount.dealerNetAmount)}、三大法人合計 ${toYi(flowDigest.cumulativeAmount.totalNetAmount)}`
          : "（尚無金額資料）",
        "",
        "【三大法人合計買超前15名】",
        ...flowDigest.topNetBuy.map(
          (s) => `${s.stockId} ${s.stockName}（${s.market}）合計買超 ${s.netShares.toLocaleString()} 股`
        ),
        "",
        "【三大法人合計賣超前15名】",
        ...flowDigest.topNetSell.map(
          (s) => `${s.stockId} ${s.stockName}（${s.market}）合計賣超 ${Math.abs(s.netShares).toLocaleString()} 股`
        ),
        "",
        "【每日買超家數（市場寬度）】",
        ...flowDigest.dailyBreadth.map(
          (d) =>
            `${d.date}：外資買超 ${d.foreignBuyCount}/${d.totalStocks} 檔、投信買超 ${d.trustBuyCount}/${d.totalStocks} 檔、自營商買超 ${d.dealerBuyCount}/${d.totalStocks} 檔`
        ),
      ].join("\n")
    : "（近期無三大法人資料，無候選標的可供分析）";

  const response = await openaiInvestment.responses.parse({
    model: "gpt-4o-mini",
    instructions: `你是台灣股市的資訊整理助理，任務是根據提供的「近期新聞」與「三大法人買賣超統計」兩份公開資料，做中性的資訊彙整，幫助使用者快速掌握市場狀況。

規則（務必遵守）：
- newsSummary：用 3-5 句繁體中文摘要近期新聞重點，句子順序務必依「即時性」排列：
  1. 第一句必須是即時性最高的內容（當日/近日大盤走勢、國際政經情勢如利率/油價/地緣政治、重大產業或公司即時事件），不可以「落後公布的月度統計數據」開頭。
  2. 「落後公布的月度統計數據」（例如新聞雖是今天發布，但內容是「前8月累計獲利」「上月營收年增率」這類描述上個月或更早狀況的數字）只能放在最後一句，且最多只佔一句，提及時務必清楚標示是「上月／前幾月」的落後數據（例如寫「上月壽險單月獲利近400億」而非讓讀者誤以為是本週最新狀況）。
  3. 若近期新聞裡完全沒有即時性內容、只有落後統計數據，才可以用落後數據當主要內容，但仍要清楚標示時間點。
  不要逐條翻譯條列。若無新聞資料請直接說明「近期無蒐集到新聞資料」。
- institutionalSummary：用 2-4 句繁體中文說明三大法人買賣超與市場寬度（買超家數）呈現出的資金流向重點。第一句請直接引用「近5個工作天三大法人累計買賣超金額」的數字（外資/投信/自營商/合計，單位億元），再補充買超家數等質化說明。若無法人資料請直接說明「近期無三大法人資料」。
- recommendations：只能從「三大法人合計買超前15名」清單中選出 3-10 檔作為「值得關注清單」，禁止推薦不在該清單中的股票代號；若清單為空（無法人資料），recommendations 請回傳空陣列。每檔請填：
  - symbol/name：務必與清單中的代號、名稱完全一致
  - type：stock 或 etf（代號以 00 開頭且名稱含「基金」「ETF」性質者視為 etf，否則為 stock）
  - watchReason：為什麼值得關注（法人買超力道、搭配的新聞事件等），繁體中文 1-2 句
  - holdingPeriod：建議觀察／持有週期的粗略描述（例如「短線 1-2 週」「中期 1-3 個月」），不要給精確價位或到期日
  - potentialUpside：質化描述可能的正面因素，禁止給出具體報酬率數字或保證性字眼（例如不可寫「保證獲利」「必漲」）
  - riskFactors：至少 2 點具體風險因素（繁體中文）
- 全部語氣中性、資訊整理導向，不要使用「建議買入」「強烈推薦」等勸誘字眼，改用「值得關注」「可留意」等中性措辭。
- 全部文字使用繁體中文。`,
    input: `【近期新聞】\n${newsText}\n\n【三大法人買賣超統計】\n${flowText}`,
    text: { format: zodTextFormat(InvestmentReportAnalysis, "investment_report") },
  });

  const analysis = response.output_parsed;
  if (!analysis) {
    return NextResponse.json({ error: "AI 報告產生失敗，請稍後再試" }, { status: 502 });
  }

  // Defense in depth: never persist a recommendation the model invented
  // outside the candidate pool we actually gave it, even though the prompt
  // instructs it not to.
  const validSymbols = new Set((flowDigest?.topNetBuy ?? []).map((s) => s.stockId));
  const recommendations = flowDigest
    ? analysis.recommendations.filter((r) => validSymbols.has(r.symbol))
    : [];

  const { InvestmentReport } = await getInvestmentModels();
  const report = await InvestmentReport.create({
    reportDate: taipeiStartOfDay(),
    newsSummary: analysis.newsSummary,
    newsRefs: newsData.ids,
    institutionalSummary: analysis.institutionalSummary,
    recommendations,
    disclaimer: DISCLAIMER,
    generatedBy: session.userId,
    generatedAt: new Date(),
    model: "gpt-4o-mini",
  });

  // Keep only the most recent MAX_KEPT_REPORTS — reports are cheap to
  // regenerate and old ones aren't read anywhere, so there's no reason to
  // let this grow forever.
  const staleReports = await InvestmentReport.find()
    .sort({ reportDate: -1, generatedAt: -1 })
    .skip(MAX_KEPT_REPORTS)
    .select("_id");
  if (staleReports.length > 0) {
    await InvestmentReport.deleteMany({ _id: { $in: staleReports.map((r) => r._id) } });
  }

  return NextResponse.json({ report });
}
