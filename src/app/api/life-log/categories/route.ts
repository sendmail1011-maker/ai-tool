import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeLogModels } from "@/lib/mongoose-lifelog";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { DEFAULT_LIFE_LOG_CATEGORIES, DEFAULT_CATEGORY_ICON } from "@/lib/lifeLogCategories";

async function requireSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { Category } = await getLifeLogModels();

  let categories = await Category.find({ userId: session.userId }).sort({
    order: 1,
    createdAt: 1,
  });

  if (categories.length === 0) {
    await Category.insertMany(
      DEFAULT_LIFE_LOG_CATEGORIES.map((c, index) => ({
        userId: session.userId,
        name: c.name,
        icon: c.icon,
        isDefault: true,
        order: index,
      }))
    );
    categories = await Category.find({ userId: session.userId }).sort({
      order: 1,
      createdAt: 1,
    });
  }

  return NextResponse.json({ categories });
}

const CategoryInput = z.object({
  name: z.string().trim().min(1).max(20),
});

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CategoryInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "分類名稱格式錯誤" }, { status: 400 });
  }

  const { Category } = await getLifeLogModels();

  const existing = await Category.findOne({
    userId: session.userId,
    name: parsed.data.name,
  });
  if (existing) {
    return NextResponse.json({ error: "已經有這個分類了" }, { status: 409 });
  }

  const count = await Category.countDocuments({ userId: session.userId });
  const category = await Category.create({
    userId: session.userId,
    name: parsed.data.name,
    icon: DEFAULT_CATEGORY_ICON,
    isDefault: false,
    order: count,
  });

  return NextResponse.json({ category });
}
