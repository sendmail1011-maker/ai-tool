import { getInvestmentModels } from "@/lib/mongoose-investment";
import { getRecentBusinessDays } from "@/lib/investmentMarketData";
import { formatTaipeiDateKey, addDays } from "@/lib/fitnessTimezone";

export type InstitutionalFlowDigest = {
  fromDate: string;
  toDate: string;
  topNetBuy: { stockId: string; stockName: string; market: string; netShares: number }[];
  topNetSell: { stockId: string; stockName: string; market: string; netShares: number }[];
  dailyBreadth: {
    date: string;
    totalStocks: number;
    foreignBuyCount: number;
    trustBuyCount: number;
    dealerBuyCount: number;
  }[];
  // Cumulative NT$ buy/sell amount across TWSE+TPEx over the window — null
  // when no amount data has been ingested yet for these dates (older data
  // predates this field, or the amount endpoints were unavailable that day).
  cumulativeAmount: {
    foreignNetAmount: number;
    trustNetAmount: number;
    dealerNetAmount: number;
    totalNetAmount: number;
  } | null;
};

// Aggregates the raw per-stock InstitutionalFlow rows (tens of thousands of
// rows over a 5-day window) down to a handful of summary numbers that are
// actually feasible to hand to an LLM: top net buy/sell stocks, and per-day
// buy-count breadth (how many stocks each investor type was net-buying).
export async function getInstitutionalFlowDigest(days: number): Promise<InstitutionalFlowDigest | null> {
  const businessDays = getRecentBusinessDays(days);
  const start = businessDays[0];
  const end = businessDays[businessDays.length - 1];
  const rangeEnd = addDays(end, 1);

  const { InstitutionalFlow, InstitutionalFlowAmount } = await getInvestmentModels();

  const hasData = await InstitutionalFlow.exists({ tradeDate: { $gte: start, $lt: rangeEnd } });
  if (!hasData) return null;

  type StockAgg = { _id: { stockId: string; market: string }; stockName: string; netShares: number };
  type BreadthAgg = {
    _id: Date;
    totalStocks: number;
    foreignBuyCount: number;
    trustBuyCount: number;
    dealerBuyCount: number;
  };

  const match = { $match: { tradeDate: { $gte: start, $lt: rangeEnd } } };
  const groupByStock = {
    $group: {
      _id: { stockId: "$stockId", market: "$market" },
      stockName: { $last: "$stockName" },
      netShares: { $sum: "$totalNetShares" },
    },
  };

  type AmountAgg = {
    _id: null;
    foreignNetAmount: number;
    trustNetAmount: number;
    dealerNetAmount: number;
    totalNetAmount: number;
  };

  const [topNetBuy, topNetSell, dailyBreadth, cumulativeAmountAgg] = await Promise.all([
    InstitutionalFlow.aggregate<StockAgg>([match, groupByStock, { $sort: { netShares: -1 } }, { $limit: 15 }]),
    InstitutionalFlow.aggregate<StockAgg>([match, groupByStock, { $sort: { netShares: 1 } }, { $limit: 15 }]),
    InstitutionalFlow.aggregate<BreadthAgg>([
      match,
      {
        $group: {
          _id: "$tradeDate",
          totalStocks: { $sum: 1 },
          foreignBuyCount: { $sum: { $cond: [{ $gt: ["$foreignNetShares", 0] }, 1, 0] } },
          trustBuyCount: { $sum: { $cond: [{ $gt: ["$trustNetShares", 0] }, 1, 0] } },
          dealerBuyCount: { $sum: { $cond: [{ $gt: ["$dealerNetShares", 0] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    InstitutionalFlowAmount.aggregate<AmountAgg>([
      match,
      {
        $group: {
          _id: null,
          foreignNetAmount: { $sum: "$foreignNetAmount" },
          trustNetAmount: { $sum: "$trustNetAmount" },
          dealerNetAmount: { $sum: "$dealerNetAmount" },
          totalNetAmount: { $sum: "$totalNetAmount" },
        },
      },
    ]),
  ]);

  return {
    fromDate: formatTaipeiDateKey(start),
    toDate: formatTaipeiDateKey(end),
    topNetBuy: topNetBuy.map((r) => ({
      stockId: r._id.stockId,
      market: r._id.market,
      stockName: r.stockName,
      netShares: r.netShares,
    })),
    topNetSell: topNetSell.map((r) => ({
      stockId: r._id.stockId,
      market: r._id.market,
      stockName: r.stockName,
      netShares: r.netShares,
    })),
    dailyBreadth: dailyBreadth.map((r) => ({
      date: formatTaipeiDateKey(r._id),
      totalStocks: r.totalStocks,
      foreignBuyCount: r.foreignBuyCount,
      trustBuyCount: r.trustBuyCount,
      dealerBuyCount: r.dealerBuyCount,
    })),
    cumulativeAmount: cumulativeAmountAgg[0]
      ? {
          foreignNetAmount: cumulativeAmountAgg[0].foreignNetAmount,
          trustNetAmount: cumulativeAmountAgg[0].trustNetAmount,
          dealerNetAmount: cumulativeAmountAgg[0].dealerNetAmount,
          totalNetAmount: cumulativeAmountAgg[0].totalNetAmount,
        }
      : null,
  };
}

export type PromptNewsItem = {
  title: string;
  source: string;
  publishedAt: string;
  category: string;
  summary?: string;
};

export async function getRecentNewsForPrompt(
  days: number,
  limit: number
): Promise<{ items: PromptNewsItem[]; ids: string[] }> {
  const [since] = getRecentBusinessDays(days);
  const { NewsDigest } = await getInvestmentModels();
  const docs = await NewsDigest.find({ publishedAt: { $gte: since } })
    .sort({ publishedAt: -1 })
    .limit(limit);

  return {
    items: docs.map((d) => ({
      title: d.title,
      source: d.source,
      publishedAt: formatTaipeiDateKey(d.publishedAt),
      category: d.category ?? "taiwan",
      summary: d.summary ?? undefined,
    })),
    ids: docs.map((d) => d._id.toString()),
  };
}
