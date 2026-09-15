import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getLifeLogModels } from "@/lib/mongoose-lifelog";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

async function requireSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: "date 參數格式須為 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const { Entry } = await getLifeLogModels();
  const date = new Date(`${dateParam}T00:00:00.000Z`);

  const entries = await Entry.find({ userId: session.userId, date }).sort({
    createdAt: 1,
  });

  return NextResponse.json({ entries });
}

const EntryInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().positive().max(1440),
  categoryIds: z.array(z.string().min(1)).min(1),
  note: z.string().trim().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = EntryInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  const { Category, Entry } = await getLifeLogModels();

  const categoryIds = [...new Set(parsed.data.categoryIds)];
  const categories = await Category.find({
    _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
    userId: session.userId,
  });

  if (categories.length !== categoryIds.length) {
    return NextResponse.json({ error: "分類不存在" }, { status: 400 });
  }

  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);

  const saved = await Entry.insertMany(
    categories.map((c) => ({
      userId: session.userId,
      categoryId: c._id,
      categoryName: c.name,
      categoryIcon: c.icon,
      note: parsed.data.note ?? "",
      minutes: parsed.data.minutes,
      date,
    }))
  );

  return NextResponse.json({ entries: saved });
}
