/**
 * Page guards (server components). They mirror v63's routing rules, but are
 * enforced on the server:
 *   * Account, Reviews and Chat need a signed-in staff member (or, for
 *     Reviews, guest mode) — otherwise to /login.
 *   * Guests can't open Account or Chat — back to Home.
 *   * Operator pages need an operator or admin; Admin pages need an admin.
 *     Signed out -> that portal's sign-in page; signed in without the role ->
 *     /access-denied (v63 showed a confusing sign-in screen instead).
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, isOperatorOrAdmin, type SessionUser } from "@/lib/auth/session";

export async function isGuest() {
  return (await cookies()).get("pc_guest")?.value === "1";
}

export async function requireStaff(path: string, opts: { allowGuest?: boolean } = {}): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (user) return user;
  if (await isGuest()) {
    if (opts.allowGuest) return null;
    redirect("/");
  }
  redirect(`/login?next=${encodeURIComponent(path)}`);
}

export async function requirePortal(portal: "operator" | "admin"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(portal === "operator" ? "/operator/sign-in" : "/admin/sign-in");
  const allowed = portal === "operator" ? isOperatorOrAdmin(user.role) : user.role === "admin";
  if (!allowed) redirect("/access-denied");
  return user;
}
