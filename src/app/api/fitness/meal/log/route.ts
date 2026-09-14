import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { MEAL_TYPES } from "@/models/fitness/MealLog";
import { resolveDayRange } from "@/lib/dateRange";

const MealLogInput = z.object({
  mealType: z.enum(MEAL_TYPES),
  description: z.string().min(1),
  estimatedCalories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  feedback: z.string().optional(),
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

  const { MealLog } = await getFitnessModels();
  const meals = await MealLog.find({
    userId: session.userId,
    date: { $gte: start, $lt: end },
  }).sort({ date: 1 });

  return NextResponse.json({ meals });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = MealLogInput.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const { MealLog } = await getFitnessModels();
  const meal = await MealLog.create({
    userId: session.userId,
    date: new Date(),
    ...parsed.data,
  });

  return NextResponse.json({ meal });
}
