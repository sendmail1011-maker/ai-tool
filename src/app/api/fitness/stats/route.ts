import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { computeFitnessStats } from "@/lib/fitnessStats";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const range = rangeParam === "month" || rangeParam === "year" ? rangeParam : "day";

  const dateParam = searchParams.get("date");
  const refDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T00:00:00`) : new Date();

  const stats = await computeFitnessStats(session.userId, range, refDate);

  return NextResponse.json(stats);
}
