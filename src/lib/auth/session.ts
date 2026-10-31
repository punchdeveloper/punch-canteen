/**
 * Sessions.
 *
 * After a magic link is used we create a random 32-byte token, put it in an
 * httpOnly cookie, and store only its SHA-256 hash in `sessions`. Every
 * request re-reads the user from the database, so a role change, suspension
 * or removal takes effect immediately (v63 cached the role in the browser and
 * let removed admins keep calling money functions).
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "pc_session";
const SESSION_DAYS = 30;
/** Only refresh `lastSeenAt` every few minutes, not on every request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** The fields every page and API route needs about the signed-in person. */
export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isMaster: boolean;
  weeklyTicketKobo: number;
  walletKobo: number;
};

/** Create a session for `userId` and set the cookie. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: clientIp(h),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * The signed-in user for this request, or null.
 * Cached per request (React `cache`) so layouts, pages and helpers can all
 * call it without extra queries. Suspended, deactivated or removed accounts
 * are treated as signed out.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.status !== "active" || u.removedAt) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Fire-and-forget: a failed touch must never break the request.
    db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isMaster: u.isMaster,
    weeklyTicketKobo: u.weeklyTicketKobo,
    walletKobo: u.walletKobo,
  };
});

/** Sign out this browser: delete the session row and the cookie. */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Sign a user out everywhere (used when an admin suspends or removes them). */
export async function destroyAllSessionsFor(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** Best-effort client IP (behind Traefik/Nginx the first X-Forwarded-For hop). */
export function clientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

export const isOperatorOrAdmin = (role: Role) => role === "operator" || role === "admin";
