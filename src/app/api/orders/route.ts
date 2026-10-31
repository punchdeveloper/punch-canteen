/**
 * GET  /api/orders — the signed-in person's orders (polled on My orders).
 * POST /api/orders { items: [{ menuItemId, quantity }] } — place an order,
 *      paid from Weekly Ticket first, then Personal Wallet.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { cartLines } from "@/lib/validation";
import { placeOrder } from "@/server/orders";
import { loadMyOrders } from "@/server/loaders";

export const GET = route({ auth: "signed-in" }, async ({ user }) => ({ orders: await loadMyOrders(user.id) }));

export const POST = route({ auth: "signed-in", body: z.object({ items: cartLines }) }, async ({ user, body }) => {
  const order = await placeOrder(user.id, body.items);
  return { order: { id: order.id, ticketNumber: order.ticketNumber } };
});
