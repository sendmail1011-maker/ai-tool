import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFitnessModels } from "@/lib/mongoose-fitness";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { resolveDayRange } from "@/lib/dateRange";

const StepsInput = z.object({
  steps: z.number().int().nonnegative().max(200000),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function startOfDay(dateParam?: string) {
  return resolveDayRange(dateParam).start;
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
  const date = startOfDay(searchParams.get("date") ?? undefined);

  const { StepLog } = await getFitnessModels();
  const entry = await StepLog.findOne({ userId: session.userId, date });

  return NextResponse.json({ entry });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const parsed = StepsInput.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入資料有誤" }, { status: 400 });
  }

  const { steps, date: dateParam } = parsed.data;
  const date = startOfDay(dateParam);

  const { StepLog } = await getFitnessModels();
  const entry = await StepLog.findOneAndUpdate(
    { userId: session.userId, date },
    { userId: session.userId, date, steps },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return NextResponse.json({ entry });
}
