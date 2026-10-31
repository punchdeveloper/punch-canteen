/**
 * Staff orders.
 *
 * placeOrder — ports v63's `place_order` database function:
 *   * prices always come from the database, never from the browser;
 *   * the person's balances are locked while the order is created;
 *   * the Weekly Ticket pays first, the Personal Wallet covers the rest;
 *   * the order is refused if the two together can't cover it;
 *   * one ledger row per balance used.
 * New in the rebuild: the order itself stores both amounts.
 *
 * Status flow (operator):  received -> ready -> collected
 * v63 stopped at "ready" and the ticket stayed VALID forever; "collected"
 * marks the ticket as used.
 */
import "server-only";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { splitPayment } from "@/lib/money";
import { makeReference } from "@/lib/references";
import { audit } from "@/lib/audit";
import { applyBalanceChange, lockBalances } from "@/server/ledger";
import type { OrderStatus } from "@/generated/prisma/enums";

export type CartLine = { menuItemId: number; quantity: number };

/** Merge duplicate lines and drop empty ones. */
export function normaliseCart(lines: CartLine[]): CartLine[] {
  const merged = new Map<number, number>();
  for (const l of lines) merged.set(l.menuItemId, (merged.get(l.menuItemId) ?? 0) + l.quantity);
  return [...merged].filter(([, q]) => q > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

/** Price a cart from the live menu. Throws if an item is missing or unavailable. */
export async function priceCart(lines: CartLine[]) {
  const cart = normaliseCart(lines);
  if (!cart.length) throw new AppError("Cart is empty");
  const items = await db.menuItem.findMany({ where: { id: { in: cart.map((l) => l.menuItemId) } } });
  const priced = cart.map((line) => {
    const item = items.find((i) => i.id === line.menuItemId);
    if (!item || !item.available) {
      throw new AppError(`${item?.name ?? "A menu item"} is no longer available. Please update your cart.`, 409, "unavailable");
    }
    return {
      menuItemId: item.id,
      itemName: item.name,
      unitPriceKobo: item.priceKobo,
      quantity: line.quantity,
      subtotalKobo: item.priceKobo * line.quantity,
    };
  });
  return { lines: priced, totalKobo: priced.reduce((n, l) => n + l.subtotalKobo, 0) };
}

export async function placeOrder(userId: string, lines: CartLine[]) {
  const { lines: priced, totalKobo } = await priceCart(lines);

  return db.$transaction(async (tx) => {
    const balances = await lockBalances(tx, userId);
    const split = splitPayment(totalKobo, balances.weeklyTicketKobo, balances.walletKobo);
    if (!split) {
      // The checkout page works out the shortfall from the balances it shows.
      throw new AppError("Insufficient balance. Please top up your wallet.", 400, "insufficient_funds");
    }

    const ticketNumber = makeReference("PCH");
    const order = await tx.order.create({
      data: {
        userId,
        totalKobo,
        weeklyTicketKobo: split.fromWeeklyTicket,
        walletKobo: split.fromWallet,
        ticketNumber,
        items: { create: priced },
      },
      include: { items: true },
    });

    await applyBalanceChange(tx, {
      userId,
      account: "weekly_ticket",
      deltaKobo: -split.fromWeeklyTicket,
      type: "order_payment",
      description: "Weekly Ticket used for canteen order",
      reference: ticketNumber,
      orderId: order.id,
      createdById: userId,
    });
    await applyBalanceChange(tx, {
      userId,
      account: "wallet",
      deltaKobo: -split.fromWallet,
      type: "order_payment",
      description: "Personal Wallet used for canteen order",
      reference: ticketNumber,
      orderId: order.id,
      createdById: userId,
    });
    return order;
  });
}

/** A person's own orders, newest first. */
export function listMyOrders(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });
}

/** Orders the kitchen still has to deal with (received or ready), oldest first. */
export function listOperatorQueue() {
  return db.order.findMany({
    where: { status: { in: ["received", "ready"] } },
    orderBy: { createdAt: "asc" },
    include: { items: true, user: { select: { fullName: true } } },
  });
}

/** Allowed operator moves. Anything else is refused. */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  received: "ready",
  ready: "collected",
};

export async function advanceOrder(orderId: number, to: OrderStatus, actorId: string) {
  return db.$transaction(async (tx) => {
    // Lock the order so two operators can't move it at the same time.
    const rows = await tx.$queryRaw<{ status: OrderStatus }[]>`
      SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const current = rows[0];
    if (!current) throw notFound("Order");
    if (NEXT_STATUS[current.status] !== to) {
      throw new AppError(`This order is already ${current.status}. Refresh to see the latest status.`, 409, "stale");
    }
    const now = new Date();
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        handledById: actorId,
        ...(to === "ready" ? { readyAt: now } : {}),
        ...(to === "collected" ? { collectedAt: now } : {}),
      },
    });
    await audit(
      {
        actorId,
        action: `order.${to}`,
        entityType: "order",
        entityId: orderId,
        message: `Order ${orderId} marked ${to}`,
        meta: { ticketNumber: order.ticketNumber },
      },
      tx,
    );
    return order;
  });
}
