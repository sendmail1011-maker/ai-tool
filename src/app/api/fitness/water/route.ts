import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const WaterInput = z.object({
  amountMl: z.number().int().positive().max(5000),
});

function dayRange(dateParam: string | null) {
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(dateParam) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

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
  const { start, end } = dayRange(searchParams.get("date"));

  const { WaterLog } = await getFitnessModels();
  const entries = await WaterLog.find({
    userId: session.userId,
    date: { $gte: start, $lt: end },
  }).sort({ date: 1 });

  const totalMl = entries.reduce((sum, e) => sum + e.amountMl, 0);

  return NextResponse.json({ entries, totalMl });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = WaterInput.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const { WaterLog } = await getFitnessModels();
  const entry = await WaterLog.create({
    userId: session.userId,
    date: new Date(),
    amountMl: parsed.data.amountMl,
  });

  return NextResponse.json({ entry });
}
