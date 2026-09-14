import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { computeFitnessStats } from "@/lib/fitnessStats";
import { resolveDate } from "@/lib/dateRange";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const range =
    rangeParam === "week" || rangeParam === "month" || rangeParam === "year" ? rangeParam : "day";

  const refDate = resolveDate(searchParams.get("date"));

  const stats = await computeFitnessStats(session.userId, range, refDate);

  return NextResponse.json(stats);
}
