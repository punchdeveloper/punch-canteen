/** Shown when a signed-in person opens a portal their role doesn't allow. */
import type { Metadata } from "next";
import { AccessDenied } from "@/components/views/portal-views";

export const metadata: Metadata = { title: "Access restricted" };

export default function AccessDeniedPage() {
  return <AccessDenied />;
}
