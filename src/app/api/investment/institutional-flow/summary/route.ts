import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getInstitutionalFlowDigest } from "@/lib/investmentReportInput";

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : null;
}

// Read-only aggregate view over already-ingested InstitutionalFlow data
// (top net buy/sell, market breadth, cumulative NT$ amount) for the last
// `days` business days — lets the frontend show this without generating a
// full AI report.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 5;

  const digest = await getInstitutionalFlowDigest(days);

  return NextResponse.json({ digest });
}
