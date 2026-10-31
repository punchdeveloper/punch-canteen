/**
 * GET /api/me — who is signed in, live balances and unread chat counts.
 * Polled by the app shell every few seconds (badges, header, balances).
 * Answers { ok: true, me: null } when signed out.
 */
import { route } from "@/lib/api";
import { loadMe } from "@/server/loaders";

export const GET = route({ auth: "public" }, async ({ user }) => ({ me: user ? await loadMe(user) : null }));
