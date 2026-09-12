import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectAccountingDb } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { ACCOUNTING_GROUPS, type AccountingGroup } from "@/lib/accountingCategories";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const scope = searchParams.get("scope") === "all" ? "all" : "self";
  const requestedUserId = searchParams.get("userId");

  if ((scope === "all" || requestedUserId) && session.role !== "admin") {
    return NextResponse.json(
      { error: "沒有權限查看其他使用者的帳目" },
      { status: 403 }
    );
  }

  let start: Date;
  let end: Date;
  let period: string;

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "month 參數格式須為 YYYY-MM" },
        { status: 400 }
      );
    }
    const [y, m] = month.split("-").map(Number);
    start = new Date(Date.UTC(y, m - 1, 1));
    end = new Date(Date.UTC(y, m, 1));
    period = month;
  } else if (year) {
    if (!/^\d{4}$/.test(year)) {
      return NextResponse.json(
        { error: "year 參數格式須為 YYYY" },
        { status: 400 }
      );
    }
    const y = Number(year);
    start = new Date(Date.UTC(y, 0, 1));
    end = new Date(Date.UTC(y + 1, 0, 1));
    period = year;
  } else {
    return NextResponse.json(
      { error: "需提供 month=YYYY-MM 或 year=YYYY 其中一個參數" },
      { status: 400 }
    );
  }

  await connectAccountingDb();

  const match: Record<string, unknown> = { date: { $gte: start, $lt: end } };
  if (scope !== "all") {
    match.userId = new Types.ObjectId(requestedUserId || session.userId);
  }

  const rows = await Transaction.aggregate<{
    _id: { group: AccountingGroup; subCategory: string };
    total: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { group: "$group", subCategory: "$subCategory" },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const groups: Record<
    AccountingGroup,
    { total: number; subCategories: Record<string, number> }
  > = {
    固定支出: { total: 0, subCategories: {} },
    變動支出: { total: 0, subCategories: {} },
    收入與資產: { total: 0, subCategories: {} },
  };

  for (const row of rows) {
    const bucket = groups[row._id.group];
    if (!bucket) continue;
    bucket.subCategories[row._id.subCategory] = row.total;
    bucket.total += row.total;
  }

  return NextResponse.json({ period, groups, groupOrder: ACCOUNTING_GROUPS });
}
