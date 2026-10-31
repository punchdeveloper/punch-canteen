/**
 * POST /api/operator/orders/:id { to: "ready" | "collected" }
 * Moves a staff order one step on. Out-of-order moves are refused.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { idParam } from "@/lib/validation";
import { advanceOrder } from "@/server/orders";

export const POST = route(
  { auth: "operator", body: z.object({ to: z.enum(["ready", "collected"]) }) },
  async ({ user, body, params }) => {
    const order = await advanceOrder(idParam.parse(params.id), body.to, user.id);
    return { order: { id: order.id, status: order.status } };
  },
);
