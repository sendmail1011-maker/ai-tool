import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { deleteFaithBlob } from "@/lib/faithBlob";

const token = process.env.BLOB_READ_WRITE_TOKEN;

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/;
const MAX_BYTES = 8 * 1024 * 1024;

async function requireSession(request: NextRequest) {
  const cookieToken = request.cookies.get(SESSION_COOKIE)?.value;
  return cookieToken ? verifySessionToken(cookieToken) : null;
}

export async function POST(request: NextRequest) {
  if (!token) {
    return NextResponse.json({ error: "圖片上傳服務未設定" }, { status: 500 });
  }

  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const match = imageBase64.match(DATA_URL_PATTERN);
  if (!match) {
    return NextResponse.json({ error: "圖片格式錯誤" }, { status: 400 });
  }

  const [, contentType, base64Data] = match;
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "圖片檔案過大" }, { status: 400 });
  }

  const extension = contentType.split("/")[1];
  const pathname = `faith/${session.userId}/${randomUUID()}.${extension}`;

  try {
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType,
      token,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("faith upload: put() failed", err);
    const message = err instanceof Error ? err.message : "圖片上傳失敗";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Called when the user removes or replaces a picked image before saving an
// entry, so an uploaded-but-never-attached image doesn't sit around forever.
export async function DELETE(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  if (url) {
    await deleteFaithBlob(url, session.userId);
  }

  return NextResponse.json({ ok: true });
}
