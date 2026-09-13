import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const Input = z.object({
  planId: z.string(),
  dayIndex: z.number().int().min(0).max(6),
  completed: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = Input.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const { planId, dayIndex, completed } = parsed.data;
  const { WorkoutPlan } = await getFitnessModels();

  const plan = await WorkoutPlan.findOne({ _id: planId, userId: session.userId });
  if (!plan) {
    return NextResponse.json({ error: "找不到訓練計畫" }, { status: 404 });
  }

  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!day) {
    return NextResponse.json({ error: "找不到該天的訓練資料" }, { status: 404 });
  }

  day.completedAt = completed ? new Date() : null;
  await plan.save();

  return NextResponse.json({ plan });
}
