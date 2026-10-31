/**
 * POST /api/operator/topups/:id { action: "confirm" } — money received; credit the wallet.
 * POST /api/operator/topups/:id { action: "reject", reason? } — nothing credited.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { idParam, optionalText } from "@/lib/validation";
import { confirmTopup, rejectTopup } from "@/server/wallet";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("reject"), reason: optionalText(200) }),
]);

export const POST = route({ auth: "operator", body: schema }, async ({ user, body, params }) => {
  const id = idParam.parse(params.id);
  const topup = body.action === "confirm" ? await confirmTopup(id, user.id) : await rejectTopup(id, user.id, body.reason);
  return { topup: { id: topup.id, status: topup.status } };
});
