/** Admin portal: finance, reviews, staff, Weekly Ticket, maintenance. */
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/guards";
import { loadAdminOverview } from "@/server/loaders";
import { AdminView } from "@/components/views/admin-view";

export const metadata: Metadata = { title: "Canteen Admin" };

export default async function AdminPage() {
  await requirePortal("admin");
  return <AdminView initial={await loadAdminOverview()} />;
}
