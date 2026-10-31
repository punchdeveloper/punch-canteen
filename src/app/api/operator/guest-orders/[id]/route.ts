/**
 * POST /api/operator/guest-orders/:id
 *   { action: "confirm" }            payment received -> ticket issued
 *   { action: "reject", reason? }    payment never arrived
 *   { action: "ready" | "collected" } kitchen progress
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { idParam, optionalText } from "@/lib/validation";
import { advanceGuestOrder, confirmGuestPayment, rejectGuestPayment } from "@/server/guest-orders";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("reject"), reason: optionalText(200) }),
  z.object({ action: z.literal("ready") }),
  z.object({ action: z.literal("collected") }),
]);

export const POST = route({ auth: "operator", body: schema }, async ({ user, body, params }) => {
  const id = idParam.parse(params.id);
  const order =
    body.action === "confirm"
      ? await confirmGuestPayment(id, user.id)
      : body.action === "reject"
        ? await rejectGuestPayment(id, user.id, body.reason)
        : await advanceGuestOrder(id, body.action, user.id);
  return { guestOrder: { id: order.id, ticketNumber: order.ticketNumber, orderStatus: order.orderStatus } };
});
