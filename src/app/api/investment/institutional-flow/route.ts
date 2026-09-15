import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInvestmentModels } from "@/lib/mongoose-investment";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { resolveDayRange } from "@/lib/dateRange";
import { addDays, formatTaipeiDateKey, taipeiStartOfDay } from "@/lib/fitnessTimezone";
import {
  getRecentBusinessDays,
  fetchTwseInstitutionalFlow,
  fetchTpexInstitutionalFlow,
  fetchTwseInstitutionalAmount,
  fetchTpexInstitutionalAmount,
  type InstitutionalFlowRow,
  type InstitutionalFlowAmountRow,
} from "@/lib/investmentMarketData";

const IngestInput = z.object({
  days: z.number().int().min(1).max(10).optional(),
});

// Report generation never looks back more than 10 business days; 30 calendar
// days is a generous buffer above that, so nothing the app reads gets pruned.
const RETENTION_DAYS = 30;

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : null;
}

// Read back what's already stored for a given Taipei day (defaults to today).
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { start, end } = resolveDayRange(searchParams.get("date"));
  const market = searchParams.get("market");

  const query: Record<string, unknown> = { tradeDate: { $gte: start, $lt: end } };
  if (market === "TWSE" || market === "TPEx") {
    query.market = market;
  }

  const { InstitutionalFlow } = await getInvestmentModels();
  const entries = await InstitutionalFlow.find(query).sort({ totalNetShares: -1 });

  return NextResponse.json({ entries });
}

// Fetch the official TWSE/TPEx daily reports for the most recent `days`
// business days (default 5) and store them, replacing any existing rows for
// those dates. Safe to re-run.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = IngestInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const dates = getRecentBusinessDays(parsed.data.days ?? 5);
  const { InstitutionalFlow, InstitutionalFlowAmount } = await getInvestmentModels();

  // TWSE/TPEx have no cross-date batch endpoint, so a multi-day backfill means
  // one request pair per day. Fetching those days in parallel (instead of one
  // date at a time) is what keeps a 5-day backfill from taking minutes.
  const results = await Promise.all(
    dates.map(async (tradeDate) => {
      let twseRows: InstitutionalFlowRow[] = [];
      let tpexRows: InstitutionalFlowRow[] = [];
      let twseAmount: InstitutionalFlowAmountRow | null = null;
      let tpexAmount: InstitutionalFlowAmountRow | null = null;
      try {
        [twseRows, tpexRows, twseAmount, tpexAmount] = await Promise.all([
          fetchTwseInstitutionalFlow(tradeDate),
          fetchTpexInstitutionalFlow(tradeDate),
          fetchTwseInstitutionalAmount(tradeDate),
          fetchTpexInstitutionalAmount(tradeDate),
        ]);
      } catch {
        return { date: formatTaipeiDateKey(tradeDate), twse: -1, tpex: -1 };
      }

      const rows = [...twseRows, ...tpexRows];
      if (rows.length > 0) {
        // Each day's report is a complete snapshot (~16k+ rows across both
        // markets), so replacing wholesale is both correct and far faster
        // than one upsert per row: per-document upsert averaged ~1.7ms/row
        // on this cluster (~27s/day) versus ~1ms/row for a delete + unordered
        // insertMany (~15s/day) in testing.
        await InstitutionalFlow.deleteMany({ tradeDate, market: { $in: ["TWSE", "TPEx"] } });
        await InstitutionalFlow.insertMany(
          rows.map((row) => ({ ...row, tradeDate })),
          { ordered: false }
        );
      }

      const amountRows = [twseAmount, tpexAmount].filter(
        (a): a is InstitutionalFlowAmountRow => a !== null
      );
      if (amountRows.length > 0) {
        await InstitutionalFlowAmount.bulkWrite(
          amountRows.map((row) => ({
            updateOne: {
              filter: { tradeDate, market: row.market },
              update: { $set: { ...row, tradeDate } },
              upsert: true,
            },
          }))
        );
      }

      return {
        date: formatTaipeiDateKey(tradeDate),
        twse: twseRows.length,
        tpex: tpexRows.length,
      };
    })
  );

  const cutoff = addDays(taipeiStartOfDay(), -RETENTION_DAYS);
  await Promise.all([
    InstitutionalFlow.deleteMany({ tradeDate: { $lt: cutoff } }),
    InstitutionalFlowAmount.deleteMany({ tradeDate: { $lt: cutoff } }),
  ]);

  return NextResponse.json({ results });
}
