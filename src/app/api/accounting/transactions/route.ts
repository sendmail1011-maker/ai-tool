import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectAccountingDb } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import {
  ACCOUNTING_GROUPS,
  ACCOUNTING_TAXONOMY,
  groupType,
  type AccountingGroup,
} from "@/lib/accountingCategories";

const TransactionInput = z.object({
  group: z.enum(ACCOUNTING_GROUPS as [AccountingGroup, ...AccountingGroup[]]),
  subCategory: z.string().min(1),
  amount: z.number().positive(),
  item: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const scope = searchParams.get("scope") === "all" ? "all" : "self";
  const requestedUserId = searchParams.get("userId");

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: "date 參數格式須為 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if ((scope === "all" || requestedUserId) && session.role !== "admin") {
    return NextResponse.json(
      { error: "沒有權限查看其他使用者的帳目" },
      { status: 403 }
    );
  }

  const date = new Date(`${dateParam}T00:00:00.000Z`);

  await connectAccountingDb();

  const query: Record<string, unknown> = { date };
  if (scope !== "all") {
    query.userId = requestedUserId || session.userId;
  }

  const transactions = await Transaction.find(query).sort({ createdAt: 1 });

  return NextResponse.json({ transactions });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const rawText =
    typeof body.rawText === "string" && body.rawText.trim()
      ? body.rawText.trim()
      : "（拍照辨識收據）";

  const parsed = z.array(TransactionInput).min(1).safeParse(body.transactions);

  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  for (const t of parsed.data) {
    if (!(ACCOUNTING_TAXONOMY[t.group] as readonly string[]).includes(t.subCategory)) {
      return NextResponse.json(
        { error: `「${t.subCategory}」不是「${t.group}」底下的分類` },
        { status: 400 }
      );
    }
  }

  await connectAccountingDb();

  const saved = await Transaction.insertMany(
    parsed.data.map((t) => ({
      rawText,
      userId: session.userId,
      userName: session.name,
      type: groupType(t.group),
      group: t.group,
      subCategory: t.subCategory,
      amount: t.amount,
      item: t.item,
      date: new Date(`${t.date}T00:00:00.000Z`),
    }))
  );

  return NextResponse.json({ transactions: saved });
}
