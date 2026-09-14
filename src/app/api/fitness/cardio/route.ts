import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { CARDIO_ACTIVITY_TYPES } from "@/models/fitness/CardioLog";
import { estimateCaloriesBurned } from "@/lib/fitnessCalories";
import { resolveDayRange } from "@/lib/dateRange";

const CardioInput = z.object({
  activityType: z.enum(CARDIO_ACTIVITY_TYPES),
  durationMinutes: z.number().positive().max(1440),
  distanceKm: z.number().positive().optional(),
  notes: z.string().trim().max(200).optional(),
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

  const { CardioLog } = await getFitnessModels();
  const entries = await CardioLog.find({
    userId: session.userId,
    date: { $gte: start, $lt: end },
  }).sort({ date: 1 });

  const totalDurationMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalCaloriesBurned = entries.reduce((sum, e) => sum + e.estimatedCaloriesBurned, 0);

  return NextResponse.json({ entries, totalDurationMinutes, totalCaloriesBurned });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = CardioInput.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const { FitnessProfile, CardioLog } = await getFitnessModels();
  const profile = await FitnessProfile.findOne({ userId: session.userId });

  if (!profile) {
    return NextResponse.json({ error: "請先完成健身資料填寫" }, { status: 400 });
  }

  const { activityType, durationMinutes, distanceKm, notes } = parsed.data;
  const estimatedCaloriesBurned = estimateCaloriesBurned(
    activityType,
    durationMinutes,
    profile.weightKg
  );

  const entry = await CardioLog.create({
    userId: session.userId,
    date: new Date(),
    activityType,
    durationMinutes,
    distanceKm,
    estimatedCaloriesBurned,
    notes,
  });

  return NextResponse.json({ entry });
}
