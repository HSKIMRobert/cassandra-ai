import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret";

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString();
}

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    // Node.js crypto not available in Edge → use Web Crypto API
    const data = JSON.parse(base64UrlDecode(payloadB64));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: data.sub, email: data.email };
  } catch {
    return null;
  }
}

const PUBLIC_PATHS = ["/login", "/api/auth"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 공개 경로는 통과
  for (const p of PUBLIC_PATHS) {
    if (path.startsWith(p)) return NextResponse.next();
  }
  // 정적 파일, 이미지 통과
  if (path.startsWith("/_next") || path.startsWith("/favicon") || path.startsWith("/images")) {
    return NextResponse.next();
  }

  // 로그인 체크
  const token = req.cookies.get("auth-token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = verifyToken(token);
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("auth-token");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next|favicon|images|api).*)",
};
