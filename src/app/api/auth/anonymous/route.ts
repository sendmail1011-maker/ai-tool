import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectAccountingDb } from "@/lib/mongoose";
import User from "@/models/User";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

function defaultNameFor(deviceId: string) {
  return `訪客${deviceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const requestedName = typeof body.name === "string" ? body.name.trim() : "";

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId 為必填欄位" }, { status: 400 });
  }

  await connectAccountingDb();

  const existing = await User.findOne({ deviceId });

  if (existing) {
    if (requestedName && requestedName !== existing.name) {
      const nameTaken = await User.findOne({
        name: requestedName,
        _id: { $ne: existing._id },
      });
      if (nameTaken) {
        return NextResponse.json(
          { error: "這個名稱已經被使用，請換一個" },
          { status: 409 }
        );
      }
      existing.name = requestedName;
      await existing.save();
    }

    const token = await createSessionToken({
      userId: existing._id.toString(),
      name: existing.name,
      role: existing.role,
      isAnonymous: true,
    });
    const response = NextResponse.json({
      user: { id: existing._id.toString(), name: existing.name, role: existing.role },
    });
    setSessionCookie(response, token);
    return response;
  }

  let finalName = requestedName || defaultNameFor(deviceId);

  if (await User.findOne({ name: finalName })) {
    if (requestedName) {
      return NextResponse.json(
        { error: "這個名稱已經被使用，請換一個" },
        { status: 409 }
      );
    }
    finalName = `${finalName}${Math.floor(Math.random() * 900 + 100)}`;
  }

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

  const user = await User.create({
    name: finalName,
    passwordHash,
    role: "member",
    isAnonymous: true,
    deviceId,
  });

  const token = await createSessionToken({
    userId: user._id.toString(),
    name: user.name,
    role: user.role,
    isAnonymous: true,
  });
  const response = NextResponse.json({
    user: { id: user._id.toString(), name: user.name, role: user.role },
  });
  setSessionCookie(response, token);
  return response;
}
