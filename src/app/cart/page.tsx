/** Cart — kept in the browser, priced from the live menu. */
import type { Metadata } from "next";
import { CartView } from "@/components/views/cart-view";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return <CartView />;
}
