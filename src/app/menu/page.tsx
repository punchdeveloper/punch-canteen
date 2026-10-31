/** Today's menu. Data comes from the shell (refreshed every minute). */
import type { Metadata } from "next";
import { MenuView } from "@/components/views/menu-view";

export const metadata: Metadata = { title: "Menu" };

export default function MenuPage() {
  return <MenuView />;
}
