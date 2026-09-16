import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFaithModels } from "@/lib/mongoose-faith";
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

  const { Entry } = await getFaithModels();

  const entries = await Entry.find({ userId: session.userId })
    .sort({ createdAt: -1 })
    .limit(100);

  return NextResponse.json({ entries });
}

const EntryInput = z.object({
  content: z.string().trim().min(1).max(2000),
  moodTags: z.array(z.string().trim().min(1).max(10)).max(10).optional(),
  imageUrl: z.string().trim().url().max(500).optional(),
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

  const { Entry } = await getFaithModels();

  const entry = await Entry.create({
    userId: session.userId,
    content: parsed.data.content,
    moodTags: [...new Set(parsed.data.moodTags ?? [])],
    imageUrl: parsed.data.imageUrl ?? "",
  });

  return NextResponse.json({ entry });
}
