/**
 * Guest orders — visitors without a staff account.
 *
 * Flow (from v63): the guest fills in name + phone, transfers the exact amount
 * to the canteen account and submits a payment request. An operator confirms
 * the transfer, which issues a guest food ticket and sends the order to the
 * kitchen. The guest checks progress with their payment reference.
 *
 * Fixes vs v63: anonymous requests are rate-limited per IP, the phone number
 * is validated, an operator can reject a payment that never arrived, and the
 * kitchen flow ends with "collected" so the ticket is used up.
 */
import "server-only";
import { db, type Tx } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { makeReference } from "@/lib/references";
import { audit } from "@/lib/audit";
import { priceCart, type CartLine } from "@/server/orders";
import type { GuestOrderStatus } from "@/generated/prisma/enums";

export async function createGuestOrder(input: { guestName: string; phoneNumber: string; lines: CartLine[]; ipHash: string | null }) {
  const { lines, totalKobo } = await priceCart(input.lines);
  if (totalKobo <= 0) throw new AppError("Cart is empty");
  return db.guestOrder.create({
    data: {
      guestName: input.guestName,
      phoneNumber: input.phoneNumber,
      totalKobo,
      paymentReference: makeReference("GUEST"),
      ipHash: input.ipHash,
      items: { create: lines },
    },
  });
}

/** Public lookup by payment reference (case-insensitive). Returns only what the guest needs. */
export async function lookupGuestOrder(reference: string) {
  const order = await db.guestOrder.findFirst({
    where: { paymentReference: { equals: reference.trim(), mode: "insensitive" } },
    select: {
      guestName: true,
      totalKobo: true,
      paymentReference: true,
      paymentStatus: true,
      orderStatus: true,
      ticketNumber: true,
      rejectionReason: true,
      createdAt: true,
      confirmedAt: true,
    },
  });
  return order;
}

/** Everything the Operator portal shows: pending payments + paid orders still in the kitchen. */
export function listGuestOrdersForOperator() {
  return db.guestOrder.findMany({
    where: {
      OR: [
        { paymentStatus: "pending" },
        { paymentStatus: "confirmed", orderStatus: { in: ["received", "ready"] } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });
}

async function lockGuest(tx: Tx, id: number) {
  const rows = await tx.$queryRaw<{ payment_status: string; order_status: GuestOrderStatus }[]>`
    SELECT payment_status, order_status FROM guest_orders WHERE id = ${id} FOR UPDATE`;
  if (!rows[0]) throw notFound("Guest order");
  return rows[0];
}

export async function confirmGuestPayment(id: number, actorId: string) {
  return db.$transaction(async (tx) => {
    const row = await lockGuest(tx, id);
    if (row.payment_status !== "pending") throw new AppError("This guest payment has already been processed.", 409, "stale");
    const order = await tx.guestOrder.update({
      where: { id },
      data: {
        paymentStatus: "confirmed",
        orderStatus: "received",
        ticketNumber: makeReference("GUEST-PCH"),
        confirmedById: actorId,
        confirmedAt: new Date(),
      },
    });
    await audit(
      {
        actorId,
        action: "guest.confirm",
        entityType: "guest_order",
        entityId: id,
        message: `Confirmed ${formatMoney(order.totalKobo)} guest payment from ${order.guestName}`,
        meta: { reference: order.paymentReference, ticket: order.ticketNumber },
      },
      tx,
    );
    return order;
  });
}

export async function rejectGuestPayment(id: number, actorId: string, reason: string | null) {
  return db.$transaction(async (tx) => {
    const row = await lockGuest(tx, id);
    if (row.payment_status !== "pending") throw new AppError("This guest payment has already been processed.", 409, "stale");
    const order = await tx.guestOrder.update({
      where: { id },
      data: { paymentStatus: "rejected", orderStatus: "cancelled", rejectionReason: reason || null, confirmedById: actorId, confirmedAt: new Date() },
    });
    await audit(
      {
        actorId,
        action: "guest.reject",
        entityType: "guest_order",
        entityId: id,
        message: `Rejected ${formatMoney(order.totalKobo)} guest payment from ${order.guestName}`,
        meta: { reference: order.paymentReference, reason },
      },
      tx,
    );
    return order;
  });
}

const GUEST_NEXT: Partial<Record<GuestOrderStatus, GuestOrderStatus>> = { received: "ready", ready: "collected" };

export async function advanceGuestOrder(id: number, to: GuestOrderStatus, actorId: string) {
  return db.$transaction(async (tx) => {
    const row = await lockGuest(tx, id);
    // An unpaid guest order must never enter the kitchen workflow.
    if (row.payment_status !== "confirmed") throw new AppError("Guest payment has not been confirmed");
    if (GUEST_NEXT[row.order_status] !== to) {
      throw new AppError(`This order is already ${row.order_status}. Refresh to see the latest status.`, 409, "stale");
    }
    const now = new Date();
    const order = await tx.guestOrder.update({
      where: { id },
      data: { orderStatus: to, ...(to === "ready" ? { readyAt: now } : { collectedAt: now }) },
    });
    await audit(
      { actorId, action: `guest.${to}`, entityType: "guest_order", entityId: id, message: `Guest order ${order.ticketNumber} marked ${to}` },
      tx,
    );
    return order;
  });
}
