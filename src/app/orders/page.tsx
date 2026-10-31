/**
 * My orders (staff) or Track guest order (guests).
 * Signed out and not a guest: the staff layout with no orders, as in v63.
 */
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/session";
import { isGuest } from "@/lib/auth/guards";
import { loadMyOrders } from "@/server/loaders";
import { GuestOrdersView, StaffOrdersView } from "@/components/views/orders-view";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const user = await getSessionUser();
  if (!user && (await isGuest())) {
    const { reference } = await searchParams;
    return <GuestOrdersView reference={reference?.slice(0, 60) ?? null} />;
  }
  return <StaffOrdersView initialOrders={user ? await loadMyOrders(user.id) : null} staffName={user?.fullName ?? "PUNCH Staff"} />;
}
