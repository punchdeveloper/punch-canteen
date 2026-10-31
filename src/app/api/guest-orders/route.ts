/**
 * POST /api/guest-orders { guestName, phoneNumber, items } — a visitor's
 *      payment request (no account needed). Rate-limited per IP.
 * GET  /api/guest-orders?reference=GUEST-… — check a guest order's status.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { route } from "@/lib/api";
import { cartLines, personName, phoneNumber } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, sha256 } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createGuestOrder, lookupGuestOrder } from "@/server/guest-orders";

const createSchema = z.object({ guestName: personName.max(100), phoneNumber, items: cartLines });

export const POST = route({ auth: "public", body: createSchema }, async ({ body }) => {
  const ip = clientIp(await headers());
  if (ip) rateLimit(`guest:${ip}`, 5, 60 * 60_000, "Too many guest orders from this connection. Please try again later or ask at the counter.");
  const order = await createGuestOrder({
    guestName: body.guestName,
    phoneNumber: body.phoneNumber,
    lines: body.items,
    ipHash: ip ? sha256(ip) : null,
  });
  return { paymentReference: order.paymentReference, totalKobo: order.totalKobo };
});

const lookupSchema = z.object({ reference: z.string().trim().min(6, "Enter your payment reference").max(60) });

export const GET = route({ auth: "public", query: lookupSchema }, async ({ query }) => {
  const ip = clientIp(await headers());
  if (ip) rateLimit(`guest-lookup:${ip}`, 60, 15 * 60_000);
  const order = await lookupGuestOrder(query.reference);
  if (!order) throw new AppError("No guest payment was found with that reference.", 404, "not_found");
  return { order };
});
