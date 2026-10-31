/** "Check your email" after requesting a sign-in link. */
import type { Metadata } from "next";
import { CheckEmailView } from "@/components/views/login-view";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return <CheckEmailView />;
}
