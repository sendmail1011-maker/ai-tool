import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { resolveDayRange, getDayRange } from "@/lib/dateRange";

const WeightInput = z.object({
  weightKg: z.number().positive(),
});

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
  const { start, end } = resolveDayRange(searchParams.get("date"));

  const { WeightLog } = await getFitnessModels();
  const entry = await WeightLog.findOne({
    userId: session.userId,
    date: { $gte: start, $lt: end },
  });

  return NextResponse.json({ entry });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = WeightInput.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const { FitnessProfile, WeightLog } = await getFitnessModels();
  const profile = await FitnessProfile.findOne({ userId: session.userId });

  if (!profile) {
    return NextResponse.json({ error: "請先完成健身資料填寫" }, { status: 400 });
  }

  const { weightKg } = parsed.data;
  const { start, end } = getDayRange(new Date());

  // Keep the profile's weight in sync so downstream calculations (diet plan
  // targets, cardio calorie estimates) use the latest logged weight.
  profile.weightKg = weightKg;
  await profile.save();

  const entry = await WeightLog.findOneAndUpdate(
    { userId: session.userId, date: { $gte: start, $lt: end } },
    { userId: session.userId, date: new Date(), weightKg },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return NextResponse.json({ entry });
}
