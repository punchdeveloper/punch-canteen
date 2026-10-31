/**
 * Magic-link sign-in.
 *
 * 1. requestMagicLink: if the email belongs to an approved (invited/active)
 *    person, create a one-time token (15 min) and email a link. The response
 *    is the same whether or not the email is approved, so the form can't be
 *    used to discover who works at PUNCH.
 * 2. consumeMagicLink: the link lands on /auth/verify, which marks the token
 *    used, activates first-time accounts, creates the session and redirects.
 *
 * The page to land on (`next`, e.g. /operator) is stored with the token, so
 * it still works when the email opens the link in a new tab — the cause of
 * the v63 "Admin portal signs me in as Staff" bug.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, sha256 } from "@/lib/auth/session";

const TOKEN_MINUTES = 15;

/** Only same-site paths are allowed as a landing page. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/auth/") || next.startsWith("/login")) return null;
  return next.slice(0, 200);
}

export async function requestMagicLink(email: string, next: string | null, ip: string | null) {
  rateLimit(`login:email:${email}`, 5, 15 * 60_000, "Too many sign-in links requested for this email. Please wait 15 minutes and try again.");
  if (ip) rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.removedAt || (user.status !== "invited" && user.status !== "active")) {
    return; // Same answer as success — see file header.
  }
  const token = randomBytes(32).toString("base64url");
  await db.loginToken.create({
    data: {
      tokenHash: sha256(token),
      userId: user.id,
      nextPath: safeNextPath(next),
      expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
      ip,
    },
  });
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  await sendMagicLinkEmail(user.email, user.fullName, `${base}/auth/verify?token=${encodeURIComponent(token)}`);
}

export type ConsumeResult = { ok: true; redirectTo: string } | { ok: false; reason: "invalid" | "expired" | "used" | "blocked" };

export async function consumeMagicLink(token: string): Promise<ConsumeResult> {
  const row = await db.loginToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };

  // Mark used first (conditional update), so a link can't be used twice even
  // if it is opened twice at the same moment.
  const claimed = await db.loginToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return { ok: false, reason: "used" };

  const u = row.user;
  if (u.removedAt || (u.status !== "invited" && u.status !== "active")) return { ok: false, reason: "blocked" };

  const now = new Date();
  await db.user.update({
    where: { id: u.id },
    data: { status: "active", lastSignInAt: now, ...(u.activatedAt ? {} : { activatedAt: now }) },
  });
  await createSession(u.id);
  return { ok: true, redirectTo: row.nextPath ?? "/" };
}
