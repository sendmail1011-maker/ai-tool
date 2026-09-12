import { NextRequest, NextResponse } from "next/server";
import { connectAccountingDb } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

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
