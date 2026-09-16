import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFaithModels } from "@/lib/mongoose-faith";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { DEFAULT_FAITH_MOOD_TAGS } from "@/lib/faithMoodTags";

async function requireSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { MoodTag } = await getFaithModels();

  let tags = await MoodTag.find({ userId: session.userId }).sort({
    order: 1,
    createdAt: 1,
  });

  if (tags.length === 0) {
    await MoodTag.insertMany(
      DEFAULT_FAITH_MOOD_TAGS.map((name, index) => ({
        userId: session.userId,
        name,
        isDefault: true,
        order: index,
      }))
    );
    tags = await MoodTag.find({ userId: session.userId }).sort({
      order: 1,
      createdAt: 1,
    });
  }

  return NextResponse.json({ tags });
}

const MoodTagInput = z.object({
  name: z.string().trim().min(1).max(10),
});

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = MoodTagInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "標籤格式錯誤" }, { status: 400 });
  }

  const { MoodTag } = await getFaithModels();

  const existing = await MoodTag.findOne({
    userId: session.userId,
    name: parsed.data.name,
  });
  if (existing) {
    return NextResponse.json({ error: "已經有這個標籤了" }, { status: 409 });
  }

  const count = await MoodTag.countDocuments({ userId: session.userId });
  const tag = await MoodTag.create({
    userId: session.userId,
    name: parsed.data.name,
    isDefault: false,
    order: count,
  });

  return NextResponse.json({ tag });
}
