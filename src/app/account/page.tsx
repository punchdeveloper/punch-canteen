/** Staff account — balances and wallet top-ups. Signed-in staff only. */
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { loadAccount } from "@/server/loaders";
import { AccountView } from "@/components/views/account-view";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = (await requireStaff("/account"))!;
  return <AccountView initial={await loadAccount(user.id)} />;
}
