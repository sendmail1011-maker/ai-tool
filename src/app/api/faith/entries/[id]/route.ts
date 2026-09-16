import { NextRequest, NextResponse } from "next/server";
import { getFaithModels } from "@/lib/mongoose-faith";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { deleteFaithBlob } from "@/lib/faithBlob";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const { Entry } = await getFaithModels();

  const deleted = await Entry.findOneAndDelete({
    _id: id,
    userId: session.userId,
  });

  if (!deleted) {
    return NextResponse.json({ error: "找不到這筆紀錄" }, { status: 404 });
  }

  if (deleted.imageUrl) {
    await deleteFaithBlob(deleted.imageUrl, session.userId);
  }

  return NextResponse.json({ ok: true });
}
