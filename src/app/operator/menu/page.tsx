/** Manage the menu and Today's Special. */
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/guards";
import { loadMenuManager } from "@/server/loaders";
import { MenuManagerView } from "@/components/views/menu-manager-view";

export const metadata: Metadata = { title: "Manage menu" };

export default async function MenuManagerPage() {
  await requirePortal("operator");
  return <MenuManagerView initial={await loadMenuManager()} />;
}
