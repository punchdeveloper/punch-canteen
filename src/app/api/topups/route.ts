/**
 * GET  /api/topups — my recent top-up requests + the canteen bank account.
 * POST /api/topups { amount } — "I transferred ₦X"; waits for an operator.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { nairaAmount } from "@/lib/validation";
import { requestTopup } from "@/server/wallet";
import { loadAccount } from "@/server/loaders";

export const GET = route({ auth: "signed-in" }, async ({ user }) => ({ account: await loadAccount(user.id) }));

export const POST = route({ auth: "signed-in", body: z.object({ amount: nairaAmount }) }, async ({ user, body }) => {
  const topup = await requestTopup(user.id, body.amount);
  return { topup: { id: topup.id, reference: topup.reference } };
});
