/**
 * System Maintenance tools that DELETE history (Admin → System Maintenance).
 *
 * These exist for test/staging environments only and are switched off unless
 * ENABLE_MAINTENANCE_TOOLS=true. In production the buttons are hidden and the
 * API refuses (v63 left "Clear test data" live on the real database).
 *
 * Deleting ledger rows would make balances stop adding up, so after clearing
 * transactions every remaining balance is re-recorded as one
 * `opening_balance` entry per account.
 */
import "server-only";
import { db, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const maintenanceEnabled = () => process.env.ENABLE_MAINTENANCE_TOOLS === "true";

function assertEnabled() {
  if (!maintenanceEnabled()) throw new AppError("Maintenance tools are switched off on this server.", 403, "disabled");
}

/** Re-create the ledger from current balances (one opening entry per non-zero account). */
async function writeOpeningBalances(tx: Tx, actorId: string) {
  const users = await tx.user.findMany({ select: { id: true, weeklyTicketKobo: true, walletKobo: true } });
  const rows = users.flatMap((u) => [
    ...(u.weeklyTicketKobo ? [{ userId: u.id, account: "weekly_ticket" as const, amountKobo: u.weeklyTicketKobo }] : []),
    ...(u.walletKobo ? [{ userId: u.id, account: "wallet" as const, amountKobo: u.walletKobo }] : []),
  ]);
  if (rows.length) {
    await tx.transaction.createMany({
      data: rows.map((r) => ({
        ...r, type: "opening_balance" as const, balanceAfterKobo: r.amountKobo,
        description: "Opening balance after history was cleared", createdById: actorId,
      })),
    });
  }
}

export async function clearOrderHistory(actorId: string) {
  assertEnabled();
  return db.$transaction(async (tx) => {
    // Reviews hang off orders; they go with them.
    const staff = await tx.order.deleteMany({});
    const guests = await tx.guestOrder.deleteMany({});
    await audit({ actorId, action: "maintenance.clear_orders", entityType: "system",
      message: `Cleared order history (${staff.count} staff, ${guests.count} guest)` }, tx);
    return { staffOrders: staff.count, guestOrders: guests.count };
  });
}

export async function clearTransactionHistory(actorId: string) {
  assertEnabled();
  return db.$transaction(async (tx) => {
    const { count } = await tx.transaction.deleteMany({});
    await writeOpeningBalances(tx, actorId);
    await audit({ actorId, action: "maintenance.clear_transactions", entityType: "system",
      message: `Cleared ${count} transaction records (balances kept as opening balances)` }, tx);
    return count;
  });
}

/**
 * Clear all activity: orders, guest orders, transactions, top-ups, reviews and
 * chat. Weekly Ticket balances of Staff-role accounts reset to zero; Personal
 * Wallet is kept unless `resetWallet` (same defaults as v63).
 */
export async function clearTestData(actorId: string, opts: { resetWallet: boolean }) {
  assertEnabled();
  return db.$transaction(async (tx) => {
    const counts = {
      staffOrders: (await tx.order.deleteMany({})).count,
      guestOrders: (await tx.guestOrder.deleteMany({})).count,
      walletRequests: (await tx.walletTopup.deleteMany({})).count,
      reviews: (await tx.review.deleteMany({})).count,
      experienceReviews: (await tx.experienceReview.deleteMany({})).count,
      chatMessages: (await tx.chatMessage.deleteMany({})).count,
      transactions: (await tx.transaction.deleteMany({})).count,
    };
    await tx.chatReadReceipt.deleteMany({});
    await tx.weeklyTicketExpiry.deleteMany({});
    const reset = await tx.user.updateMany({
      where: { role: "staff" },
      data: { weeklyTicketKobo: 0, ...(opts.resetWallet ? { walletKobo: 0 } : {}) },
    });
    await writeOpeningBalances(tx, actorId);
    await audit({ actorId, action: "maintenance.clear_test_data", entityType: "system",
      message: `Cleared test data (${reset.count} staff balances reset)`, meta: counts }, tx);
    return { ...counts, staffBalancesReset: reset.count };
  });
}
