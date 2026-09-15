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
  const password = typeof body.password === "string" ? body.password : "";

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId 為必填欄位" }, { status: 400 });
  }

  await connectAccountingDb();

  const existing = await User.findOne({ deviceIds: deviceId });

  if (existing) {
    let needsSave = false;

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
      needsSave = true;
    }

    if (password) {
      existing.passwordHash = await bcrypt.hash(password, 10);
      needsSave = true;
    }

    if (needsSave) {
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

  // Unrecognized device. If the requested name belongs to someone else's
  // anonymous account and the password matches, treat this as that same
  // person logging in from a new device rather than a name collision.
  let finalName = requestedName || defaultNameFor(deviceId);
  const nameOwner = await User.findOne({ name: finalName });

  if (nameOwner) {
    const canClaim =
      nameOwner.isAnonymous && password && (await bcrypt.compare(password, nameOwner.passwordHash));

    if (canClaim) {
      if (!nameOwner.deviceIds.includes(deviceId)) {
        nameOwner.deviceIds.push(deviceId);
        await nameOwner.save();
      }

      const token = await createSessionToken({
        userId: nameOwner._id.toString(),
        name: nameOwner.name,
        role: nameOwner.role,
        isAnonymous: true,
      });
      const response = NextResponse.json({
        user: { id: nameOwner._id.toString(), name: nameOwner.name, role: nameOwner.role },
      });
      setSessionCookie(response, token);
      return response;
    }

    if (requestedName) {
      return NextResponse.json(
        { error: "這個名稱已經被使用，如果是你自己的帳號，請輸入密碼" },
        { status: 409 }
      );
    }

    finalName = `${finalName}${Math.floor(Math.random() * 900 + 100)}`;
  }

  const passwordHash = password
    ? await bcrypt.hash(password, 10)
    : await bcrypt.hash(crypto.randomUUID(), 10);

  const user = await User.create({
    name: finalName,
    passwordHash,
    role: "member",
    isAnonymous: true,
    deviceIds: [deviceId],
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
