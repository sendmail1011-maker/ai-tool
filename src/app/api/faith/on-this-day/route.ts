import { NextRequest, NextResponse } from "next/server";
import { getFaithModels } from "@/lib/mongoose-faith";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { formatTaipeiDateKey, parseTaipeiDateKey, taipeiDayRange } from "@/lib/fitnessTimezone";

async function requireSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

function daysInMonth(year: number, month0: number) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

// Shift a "YYYY-MM-DD" key by whole months/years, clamping the day to the
// target month's length (e.g. Mar 31 minus 1 month -> Feb 28/29).
function shiftDateKey(dateKey: string, delta: { months?: number; years?: number }) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const totalMonths = m - 1 + (delta.months ?? 0) + (delta.years ?? 0) * 12;
  const year = y + Math.floor(totalMonths / 12);
  const month0 = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(d, daysInMonth(year, month0));
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const YEARS_BACK = 5;

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { Entry } = await getFaithModels();
  const todayKey = formatTaipeiDateKey();

  const candidates = [
    { kind: "month" as const, amount: 1, dateKey: shiftDateKey(todayKey, { months: -1 }) },
    ...Array.from({ length: YEARS_BACK }, (_, i) => {
      const amount = i + 1;
      return { kind: "year" as const, amount, dateKey: shiftDateKey(todayKey, { years: -amount }) };
    }),
  ];

  const groups = await Promise.all(
    candidates.map(async ({ kind, amount, dateKey }) => {
      const { start, end } = taipeiDayRange(parseTaipeiDateKey(dateKey));
      const entries = await Entry.find({
        userId: session.userId,
        createdAt: { $gte: start, $lt: end },
      }).sort({ createdAt: 1 });
      return { kind, amount, dateKey, entries };
    })
  );

  return NextResponse.json({ groups: groups.filter((g) => g.entries.length > 0) });
}
