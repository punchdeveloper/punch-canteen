/** Staff sign-in. ?next= is where to land after the magic link; ?error= explains a failed link. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/server/auth";
import { LoginView } from "@/components/views/login-view";

export const metadata: Metadata = { title: "Staff sign-in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = safeNextPath(next);
  if (await getSessionUser()) redirect(target ?? "/");
  return <LoginView next={target} linkError={error ?? null} />;
}
