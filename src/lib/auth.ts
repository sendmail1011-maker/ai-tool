import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const encodedSecret = new TextEncoder().encode(secret);
const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = {
  userId: string;
  name: string;
  role: "admin" | "member";
  isAnonymous: boolean;
};

export { isRestrictedAnonymous } from "@/lib/anonymousAccess";

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(encodedSecret);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    if (
      typeof payload.userId === "string" &&
      typeof payload.name === "string" &&
      (payload.role === "admin" || payload.role === "member")
    ) {
      return {
        userId: payload.userId,
        name: payload.name,
        role: payload.role,
        isAnonymous: payload.isAnonymous === true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export { SESSION_COOKIE };
