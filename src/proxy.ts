import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, isRestrictedAnonymous, SESSION_COOKIE } from "@/lib/auth";

const RESTRICTED_PAGE_PATHS = ["/fitness", "/faith", "/investment", "/life-log"];

function isRestrictedPath(pathname: string) {
  return RESTRICTED_PAGE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isRestrictedAnonymous(session) && isRestrictedPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "沒有權限使用此功能" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/accounting", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
