/**
 * POST /api/admin/maintenance — System Maintenance actions.
 *   { action: "reset_balances", userId?, weekly, wallet }   always available (ledgered)
 *   { action: "clear_orders",       confirmation: "CLEAR ORDERS" }        test servers only
 *   { action: "clear_transactions", confirmation: "CLEAR TRANSACTIONS" }  test servers only
 *   { action: "clear_test_data",    confirmation: "CLEAR TEST DATA", resetWallet? } test servers only
 * The typed confirmation phrases are checked here too, not just in the browser.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { resetBalances } from "@/server/wallet";
import { clearOrderHistory, clearTestData, clearTransactionHistory } from "@/server/maintenance";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset_balances"), userId: z.uuid().nullable().optional(), weekly: z.boolean(), wallet: z.boolean() }),
  z.object({ action: z.literal("clear_orders"), confirmation: z.literal("CLEAR ORDERS", { message: "Type CLEAR ORDERS to confirm" }) }),
  z.object({ action: z.literal("clear_transactions"), confirmation: z.literal("CLEAR TRANSACTIONS", { message: "Type CLEAR TRANSACTIONS to confirm" }) }),
  z.object({
    action: z.literal("clear_test_data"),
    confirmation: z.literal("CLEAR TEST DATA", { message: "Type CLEAR TEST DATA exactly" }),
    resetWallet: z.boolean().optional(),
  }),
]);

export const POST = route({ auth: "admin", body: schema }, async ({ user, body }) => {
  switch (body.action) {
    case "reset_balances":
      return { changed: await resetBalances({ userId: body.userId ?? null, weekly: body.weekly, wallet: body.wallet, actorId: user.id }) };
    case "clear_orders":
      return { result: await clearOrderHistory(user.id) };
    case "clear_transactions":
      return { cleared: await clearTransactionHistory(user.id) };
    case "clear_test_data":
      return { result: await clearTestData(user.id, { resetWallet: !!body.resetWallet }) };
  }
});
