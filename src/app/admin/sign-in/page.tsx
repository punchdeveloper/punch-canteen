/**
 * Admin portal sign-in page. Already signed in as admin -> straight into the
 * portal; signed in without the role -> Access restricted.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { PortalSignIn } from "@/components/views/portal-views";

export const metadata: Metadata = { title: "Canteen Admin access" };

export default async function AdminSignInPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/access-denied");
  return <PortalSignIn portal="admin" />;
}
