import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const ExerciseInput = z.object({
  name: z.string().trim().min(1),
  sets: z.number().int().positive(),
  reps: z.string().trim().min(1),
  restSeconds: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

const Input = z.object({
  planId: z.string(),
  dayIndex: z.number().int().min(0).max(6),
  completed: z.boolean().optional(),
  label: z.string().trim().min(1).optional(),
  isRestDay: z.boolean().optional(),
  exercises: z.array(ExerciseInput).optional(),
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

  const { planId, dayIndex, completed, label, isRestDay, exercises } = parsed.data;
  const { WorkoutPlan } = await getFitnessModels();

  const plan = await WorkoutPlan.findOne({ _id: planId, userId: session.userId });
  if (!plan) {
    return NextResponse.json({ error: "找不到訓練計畫" }, { status: 404 });
  }

  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!day) {
    return NextResponse.json({ error: "找不到該天的訓練資料" }, { status: 404 });
  }

  if (completed !== undefined) {
    day.completedAt = completed ? new Date() : null;
  }
  if (label !== undefined) {
    day.label = label;
  }
  if (isRestDay !== undefined) {
    day.isRestDay = isRestDay;
    if (isRestDay) {
      day.exercises.splice(0, day.exercises.length);
    }
  }
  if (exercises !== undefined && !day.isRestDay) {
    day.exercises.splice(0, day.exercises.length, ...exercises);
  }

  await plan.save();

  return NextResponse.json({ plan });
}
