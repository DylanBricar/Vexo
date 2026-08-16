import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const developmentScripts =
    process.env.NODE_ENV === "production" ? "" : "'unsafe-eval' http: https:";
  const upgradeInsecureRequests =
    process.env.NODE_ENV === "production" ? "upgrade-insecure-requests;" : "";
  const contentSecurityPolicy = `
    default-src 'self';
    base-uri 'self';
    connect-src 'self';
    font-src 'self';
    form-action 'self';
    frame-ancestors 'none';
    img-src 'self' data: blob:;
    media-src 'self' data: blob:;
    object-src 'none';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${developmentScripts};
    style-src 'self' 'unsafe-inline';
    worker-src 'self' blob:;
    ${upgradeInsecureRequests}
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
