/**
 * Operator portal sign-in page. Already signed in as operator/admin -> straight
 * into the portal; signed in without the role -> Access restricted.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, isOperatorOrAdmin } from "@/lib/auth/session";
import { PortalSignIn } from "@/components/views/portal-views";

export const metadata: Metadata = { title: "Canteen Operator access" };

export default async function OperatorSignInPage() {
  const user = await getSessionUser();
  if (user) redirect(isOperatorOrAdmin(user.role) ? "/operator" : "/access-denied");
  return <PortalSignIn portal="operator" />;
}
