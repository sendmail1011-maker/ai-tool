import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const Input = z
  .object({
    planId: z.string(),
    dayIndexA: z.number().int().min(0).max(6),
    dayIndexB: z.number().int().min(0).max(6),
  })
  .refine((data) => data.dayIndexA !== data.dayIndexB, {
    message: "要對調的兩天不能相同",
    path: ["dayIndexB"],
  });

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = Input.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "輸入資料有誤" },
      { status: 400 }
    );
  }

  const { planId, dayIndexA, dayIndexB } = parsed.data;
  const { WorkoutPlan } = await getFitnessModels();

  const plan = await WorkoutPlan.findOne({ _id: planId, userId: session.userId });
  if (!plan) {
    return NextResponse.json({ error: "找不到訓練計畫" }, { status: 404 });
  }

  const dayA = plan.days.find((d) => d.dayIndex === dayIndexA);
  const dayB = plan.days.find((d) => d.dayIndex === dayIndexB);
  if (!dayA || !dayB) {
    return NextResponse.json({ error: "找不到該天的訓練資料" }, { status: 404 });
  }

  // Swap everything except dayIndex itself — the workout (and whether it's
  // already been checked off) moves with the content, not the calendar slot.
  // Snapshot both sides as plain objects first so Mongoose subdocuments
  // aren't reused across two array positions.
  const toPlainExercises = (day: typeof dayA) =>
    day.exercises.map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      restSeconds: e.restSeconds,
      notes: e.notes,
    }));

  const snapshotA = {
    label: dayA.label,
    isRestDay: dayA.isRestDay,
    exercises: toPlainExercises(dayA),
    completedAt: dayA.completedAt,
  };
  const snapshotB = {
    label: dayB.label,
    isRestDay: dayB.isRestDay,
    exercises: toPlainExercises(dayB),
    completedAt: dayB.completedAt,
  };

  dayA.label = snapshotB.label;
  dayA.isRestDay = snapshotB.isRestDay;
  dayA.exercises.splice(0, dayA.exercises.length, ...snapshotB.exercises);
  dayA.completedAt = snapshotB.completedAt;

  dayB.label = snapshotA.label;
  dayB.isRestDay = snapshotA.isRestDay;
  dayB.exercises.splice(0, dayB.exercises.length, ...snapshotA.exercises);
  dayB.completedAt = snapshotA.completedAt;

  await plan.save();

  return NextResponse.json({ plan });
}
