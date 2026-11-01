import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/config/env";
import { SESSION_COOKIE, verifySessionToken } from "@/infrastructure/auth/session-token";

const LOGIN_PATH = "/login";

/** Everything is private: signed-out requests only ever reach the login screen. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = verifySessionToken(token, getEnv().SESSION_SECRET, new Date());

  if (pathname === LOGIN_PATH) {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
