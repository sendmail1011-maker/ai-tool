import {
  formatTaipeiDateKey,
  taipeiWeekdayIndex,
  taipeiStartOfDay,
  addDays,
} from "@/lib/fitnessTimezone";

export type InstitutionalFlowRow = {
  market: "TWSE" | "TPEx";
  stockId: string;
  stockName: string;
  foreignNetShares: number;
  trustNetShares: number;
  dealerNetShares: number;
  totalNetShares: number;
};

export type InstitutionalFlowAmountRow = {
  market: "TWSE" | "TPEx";
  foreignBuyAmount: number;
  foreignSellAmount: number;
  foreignNetAmount: number;
  trustBuyAmount: number;
  trustSellAmount: number;
  trustNetAmount: number;
  dealerBuyAmount: number;
  dealerSellAmount: number;
  dealerNetAmount: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalNetAmount: number;
};

function parseShareNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function twseDateParam(date: Date): string {
  return formatTaipeiDateKey(date).replace(/-/g, "");
}

// TPEx's legacy report endpoint takes the date as an ROC (Minguo) calendar
// string, e.g. 2026-09-14 -> "115/09/14".
function tpexRocDateParam(date: Date): string {
  const [year, month, day] = formatTaipeiDateKey(date).split("-").map(Number);
  return `${year - 1911}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

// The most recent `count` weekdays (Mon-Fri) ending on `date` (inclusive),
// oldest first. Taiwan market holidays aren't filtered out here — TWSE/TPEx
// simply return no rows for those dates, which the caller treats as a no-op.
export function getRecentBusinessDays(count: number, date: Date = new Date()): Date[] {
  const days: Date[] = [];
  let cursor = taipeiStartOfDay(date);
  while (days.length < count) {
    if (taipeiWeekdayIndex(cursor) < 5) {
      days.push(cursor);
    }
    cursor = addDays(cursor, -1);
  }
  return days.reverse();
}

// TWSE "三大法人買賣超日報" (T86) — one row per listed stock for `date`.
// Foreign net = 外陸資買賣超(不含自營商) + 外資自營商買賣超, since TWSE
// reports those two components separately rather than pre-combined.
export async function fetchTwseInstitutionalFlow(date: Date): Promise<InstitutionalFlowRow[]> {
  const url = `https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date=${twseDateParam(date)}&selectType=ALL`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TWSE T86 request failed: ${res.status}`);
  }
  const json = (await res.json()) as { stat?: string; data?: string[][] };
  if (json.stat !== "OK" || !Array.isArray(json.data)) {
    return [];
  }

  return json.data.map((row) => ({
    market: "TWSE" as const,
    stockId: row[0].trim(),
    stockName: row[1].trim(),
    foreignNetShares: parseShareNumber(row[4]) + parseShareNumber(row[7]),
    trustNetShares: parseShareNumber(row[10]),
    dealerNetShares: parseShareNumber(row[11]),
    totalNetShares: parseShareNumber(row[18]),
  }));
}

// TPEx "三大法人買賣明細資訊" — one row per OTC stock for `date`. Unlike
// TWSE, TPEx already provides a combined foreign (陸資+外資自營商) column and
// a combined dealer (自行買賣+避險) column, so no manual summing is needed.
export async function fetchTpexInstitutionalFlow(date: Date): Promise<InstitutionalFlowRow[]> {
  const url = `https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php?l=zh-tw&d=${tpexRocDateParam(date)}&se=EW&t=D&o=json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TPEx institutional flow request failed: ${res.status}`);
  }
  const json = (await res.json()) as { tables?: { data?: string[][] }[] };
  const rows = json.tables?.[0]?.data ?? [];

  return rows.map((row) => ({
    market: "TPEx" as const,
    stockId: row[0].trim(),
    stockName: row[1].trim(),
    foreignNetShares: parseShareNumber(row[10]),
    trustNetShares: parseShareNumber(row[13]),
    dealerNetShares: parseShareNumber(row[22]),
    totalNetShares: parseShareNumber(row[23]),
  }));
}

// TWSE "三大法人買賣金額統計表" (BFI82U) — market-wide daily buy/sell AMOUNT
// (NT$) by investor type, one row per category (not per-stock). Foreign =
// 外陸資(不含自營商) + 外資自營商; dealer = 自行買賣 + 避險; the official
// "合計" row is used directly for the total rather than re-derived, since
// TWSE's own definition of "合計" excludes 外資自營商 (folded into dealer).
export async function fetchTwseInstitutionalAmount(
  date: Date
): Promise<InstitutionalFlowAmountRow | null> {
  const url = `https://www.twse.com.tw/rwd/zh/fund/BFI82U?response=json&dayDate=${twseDateParam(date)}&type=day`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TWSE BFI82U request failed: ${res.status}`);
  }
  const json = (await res.json()) as { stat?: string; data?: string[][] };
  if (json.stat !== "OK" || !Array.isArray(json.data)) {
    return null;
  }

  const byName = new Map(json.data.map((row) => [row[0].trim(), row]));
  const amounts = (row: string[] | undefined) => ({
    buy: parseShareNumber(row?.[1]),
    sell: parseShareNumber(row?.[2]),
    net: parseShareNumber(row?.[3]),
  });

  const dealerSelf = amounts(byName.get("自營商(自行買賣)"));
  const dealerHedge = amounts(byName.get("自營商(避險)"));
  const trust = amounts(byName.get("投信"));
  const foreignExclDealer = amounts(byName.get("外資及陸資(不含外資自營商)"));
  const foreignDealer = amounts(byName.get("外資自營商"));
  const total = amounts(byName.get("合計"));

  return {
    market: "TWSE",
    foreignBuyAmount: foreignExclDealer.buy + foreignDealer.buy,
    foreignSellAmount: foreignExclDealer.sell + foreignDealer.sell,
    foreignNetAmount: foreignExclDealer.net + foreignDealer.net,
    trustBuyAmount: trust.buy,
    trustSellAmount: trust.sell,
    trustNetAmount: trust.net,
    dealerBuyAmount: dealerSelf.buy + dealerHedge.buy,
    dealerSellAmount: dealerSelf.sell + dealerHedge.sell,
    dealerNetAmount: dealerSelf.net + dealerHedge.net,
    totalBuyAmount: total.buy,
    totalSellAmount: total.sell,
    totalNetAmount: total.net,
  };
}

// TPEx equivalent summary report — already gives combined foreign/dealer
// totals directly, so no manual summing is needed.
export async function fetchTpexInstitutionalAmount(
  date: Date
): Promise<InstitutionalFlowAmountRow | null> {
  const url = `https://www.tpex.org.tw/web/stock/3insti/3insti_summary/3itrdsum_result.php?l=zh-tw&d=${tpexRocDateParam(date)}&t=D&o=json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TPEx institutional amount request failed: ${res.status}`);
  }
  const json = (await res.json()) as { tables?: { data?: string[][] }[] };
  const rows = json.tables?.[0]?.data ?? [];
  if (rows.length === 0) {
    return null;
  }

  const byName = new Map(rows.map((row) => [row[0].trim(), row]));
  const amounts = (row: string[] | undefined) => ({
    buy: parseShareNumber(row?.[1]),
    sell: parseShareNumber(row?.[2]),
    net: parseShareNumber(row?.[3]),
  });

  const foreign = amounts(byName.get("外資及陸資合計"));
  const trust = amounts(byName.get("投信"));
  const dealer = amounts(byName.get("自營商合計"));
  const total = amounts(byName.get("三大法人合計*") ?? byName.get("三大法人合計"));

  return {
    market: "TPEx",
    foreignBuyAmount: foreign.buy,
    foreignSellAmount: foreign.sell,
    foreignNetAmount: foreign.net,
    trustBuyAmount: trust.buy,
    trustSellAmount: trust.sell,
    trustNetAmount: trust.net,
    dealerBuyAmount: dealer.buy,
    dealerSellAmount: dealer.sell,
    dealerNetAmount: dealer.net,
    totalBuyAmount: total.buy,
    totalSellAmount: total.sell,
    totalNetAmount: total.net,
  };
}
