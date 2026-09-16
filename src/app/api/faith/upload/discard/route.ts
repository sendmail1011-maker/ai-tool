import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { deleteFaithBlob } from "@/lib/faithBlob";

// `navigator.sendBeacon` can only POST, so leaving the faith page (tab close,
// refresh, or in-app navigation) with an uploaded-but-unsaved image posts here
// instead of calling the DELETE endpoint above.
export async function POST(request: NextRequest) {
  const cookieToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = cookieToken ? await verifySessionToken(cookieToken) : null;
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
