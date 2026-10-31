/**
 * Proxy (Next.js 16's replacement for middleware).
 *
 * Passes the requested path to the root layout in an `x-pc-path` header so
 * the server can render the right <body> classes on first paint. Also adds
 * baseline security headers to every page.
 */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pc-path", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  // Pages only — not API routes, Next internals, media or static files.
  matcher: ["/((?!api|_next/static|_next/image|media|icons|brand|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
