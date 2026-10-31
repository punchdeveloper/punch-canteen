/** Operator portal: live orders, top-ups and guest payments. */
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/guards";
import { loadOperatorOverview } from "@/server/loaders";
import { OperatorView } from "@/components/views/operator-view";

export const metadata: Metadata = { title: "Canteen Operator" };

export default async function OperatorPage() {
  await requirePortal("operator");
  return <OperatorView initial={await loadOperatorOverview()} />;
}
