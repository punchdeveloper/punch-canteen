/**
 * GET /auth/verify?token=…  — the link inside the sign-in email.
 * Uses the token, creates the session cookie and redirects to the page the
 * person was heading for (e.g. /operator). Failures go back to /login with a
 * reason the page explains.
 */
import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicLink } from "@/server/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const base = process.env.APP_URL || req.nextUrl.origin;
  const result = token ? await consumeMagicLink(token) : ({ ok: false, reason: "invalid" } as const);
  if (!result.ok) return NextResponse.redirect(new URL(`/login?error=${result.reason}`, base));
  return NextResponse.redirect(new URL(result.redirectTo, base));
}
