import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectAccountingDb } from "@/lib/mongoose";
import User from "@/models/User";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !password) {
    return NextResponse.json({ error: "name 與 password 為必填欄位" }, { status: 400 });
  }

  await connectAccountingDb();

  const user = await User.findOne({ name });
  const isValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !isValid) {
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }

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
