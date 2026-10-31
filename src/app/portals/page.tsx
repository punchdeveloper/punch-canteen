/** Portal chooser: Operator or Admin. */
import type { Metadata } from "next";
import { PortalChooser } from "@/components/views/portal-views";

export const metadata: Metadata = { title: "Portals" };

export default function PortalsPage() {
  return <PortalChooser />;
}
