import { NextRequest, NextResponse } from "next/server";
import { connectAccountingDb } from "@/lib/mongoose";
import User from "@/models/User";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "沒有權限" }, { status: 403 });
  }

  await connectAccountingDb();

  const users = await User.find({}, { name: 1, role: 1 }).sort({ name: 1 });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      role: u.role,
    })),
  });
}
