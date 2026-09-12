import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectAccountingDb } from "@/lib/mongoose";
import User from "@/models/User";
import AdminLock from "@/models/AdminLock";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

// TODO: hardcoded per current requirements; move to env var / DB-managed codes later.
const REGISTRATION_CODE = "Fisc";

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode : "";

  if (!name || !password || !inviteCode) {
    return NextResponse.json(
      { error: "name、password 與 inviteCode 為必填欄位" },
      { status: 400 }
    );
  }

  if (inviteCode !== REGISTRATION_CODE) {
    return NextResponse.json({ error: "驗證碼錯誤" }, { status: 403 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "密碼至少需要 6 個字元" }, { status: 400 });
  }

  await connectAccountingDb();

  const existing = await User.findOne({ name });
  if (existing) {
    return NextResponse.json({ error: "這個名稱已經被使用" }, { status: 409 });
  }

  // Atomic claim: only the request that actually creates the lock doc wins admin.
  const previousLock = await AdminLock.findOneAndUpdate(
    { _id: "first_admin" },
    { $setOnInsert: { assignedAt: new Date() } },
    { upsert: true, new: false }
  );
  const role = previousLock === null ? "admin" : "member";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({ name, passwordHash, role });

  const token = await createSessionToken({
    userId: user._id.toString(),
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    user: { id: user._id.toString(), name: user.name, role: user.role },
  });
  setSessionCookie(response, token);
  return response;
}
