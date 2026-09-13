import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { SLEEP_QUALITIES } from "@/models/fitness/SleepLog";

const SleepInput = z.object({
  durationHours: z.number().positive().max(24),
  quality: z.enum(SLEEP_QUALITIES),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function startOfDay(dateParam?: string) {
  const date = dateParam ? new Date(dateParam) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
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
  const dateParam = searchParams.get("date") ?? undefined;
  const date = startOfDay(dateParam);

  const { SleepLog } = await getFitnessModels();
  const entry = await SleepLog.findOne({ userId: session.userId, date });

  return NextResponse.json({ entry });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = SleepInput.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const { durationHours, quality, date: dateParam } = parsed.data;
  const date = startOfDay(dateParam);

  const { SleepLog } = await getFitnessModels();
  const entry = await SleepLog.findOneAndUpdate(
    { userId: session.userId, date },
    { userId: session.userId, date, durationHours, quality },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return NextResponse.json({ entry });
}
