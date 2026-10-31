/** Checkout — staff pay automatically; guests pay by bank transfer. */
import type { Metadata } from "next";
import { CheckoutView } from "@/components/views/checkout-view";
import { loadBank } from "@/server/loaders";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  return <CheckoutView bank={await loadBank()} />;
}
