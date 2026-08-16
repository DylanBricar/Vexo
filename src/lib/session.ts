import type { NextRequest, NextResponse } from "next/server";
import { generateToken, verifyToken } from "@/lib/crypto";

export const SESSION_COOKIE_NAME = "vexo_session";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function getAuthenticatedUserId(request: NextRequest): number | null {
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) return verifyToken(cookieToken);

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer "))
    return verifyToken(authorization.slice(7));
  return null;
}

export function setSessionCookie(response: NextResponse, userId: number): void {
  response.cookies.set(SESSION_COOKIE_NAME, generateToken(userId), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function isTrustedMutation(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}
