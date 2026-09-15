import { NextRequest, NextResponse } from "next/server";
import { getInvestmentModels } from "@/lib/mongoose-investment";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { fetchAllNewsFeeds } from "@/lib/investmentNews";
import { getRecentBusinessDays } from "@/lib/investmentMarketData";
import { addDays, taipeiStartOfDay } from "@/lib/fitnessTimezone";

// Reports never look back more than 10 business days; 30 calendar days is a
// generous buffer above that, so nothing the app reads gets pruned.
const RETENTION_DAYS = 30;

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : null;
}

// Read back stored articles published within the last `days` business days
// (default 5), newest first.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 5;
  const category = searchParams.get("category");

  const [since] = getRecentBusinessDays(days);

  const query: Record<string, unknown> = { publishedAt: { $gte: since } };
  if (category === "taiwan" || category === "international") {
    query.category = category;
  }

  const { NewsDigest } = await getInvestmentModels();
  const entries = await NewsDigest.find(query).sort({ publishedAt: -1 });

  return NextResponse.json({ entries });
}

// Fetch all configured RSS sources and store any articles not already seen
// (deduped by URL — existing articles are left untouched, not re-written).
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const feedResults = await fetchAllNewsFeeds();
  const { NewsDigest } = await getInvestmentModels();
  const fetchedAt = new Date();

  const allItems = feedResults.flatMap((result) => result.items);
  let upsertedCount = 0;

  if (allItems.length > 0) {
    const result = await NewsDigest.bulkWrite(
      allItems.map((item) => ({
        updateOne: {
          filter: { url: item.url },
          update: { $setOnInsert: { ...item, fetchedAt } },
          upsert: true,
        },
      }))
    );
    upsertedCount = result.upsertedCount ?? 0;
  }

  const cutoff = addDays(taipeiStartOfDay(), -RETENTION_DAYS);
  await NewsDigest.deleteMany({ publishedAt: { $lt: cutoff } });

  const feeds = feedResults.map((result) => ({
    source: result.source,
    count: result.items.length,
    error: result.error,
  }));

  return NextResponse.json({ feeds, upsertedCount });
}
