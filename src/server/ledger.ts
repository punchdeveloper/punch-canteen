/**
 * The money ledger.
 *
 * ALL changes to `users.weekly_ticket_kobo` / `users.wallet_kobo` go through
 * this file. Each change:
 *   1. runs inside the caller's database transaction,
 *   2. locks the person's row (SELECT … FOR UPDATE) so two requests can't
 *      spend the same balance at once,
 *   3. refuses to take a balance below zero,
 *   4. writes one `transactions` row with the signed amount and the balance
 *      after the change.
 * Because of (4), the sum of a person's transactions per account always
 * equals their balance — `checkLedger()` verifies exactly that.
 */
import "server-only";
import { AppError } from "@/lib/errors";
import type { Tx } from "@/lib/db";
import type { Account, TransactionType } from "@/generated/prisma/enums";

export type LockedBalances = { weeklyTicketKobo: number; walletKobo: number };

/** Lock the user's row for the rest of the transaction and return balances. */
export async function lockBalances(tx: Tx, userId: string): Promise<LockedBalances> {
  const rows = await tx.$queryRaw<{ weekly_ticket_kobo: number; wallet_kobo: number }[]>`
    SELECT weekly_ticket_kobo, wallet_kobo FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new AppError("Staff account not found", 404, "not_found");
  return { weeklyTicketKobo: Number(row.weekly_ticket_kobo), walletKobo: Number(row.wallet_kobo) };
}

export type BalanceChange = {
  userId: string;
  account: Account;
  /** Signed amount in kobo: positive credits, negative debits. Zero is a no-op. */
  deltaKobo: number;
  type: TransactionType;
  description: string;
  reference?: string | null;
  orderId?: number | null;
  topupId?: number | null;
  createdById?: string | null;
};

/**
 * Apply one balance change and record it. The row must already be locked by
 * `lockBalances` in this transaction (we lock again defensively; Postgres
 * allows re-locking a row you already hold).
 */
export async function applyBalanceChange(tx: Tx, change: BalanceChange): Promise<number> {
  if (!Number.isInteger(change.deltaKobo)) throw new Error("Amounts must be whole kobo");
  const current = await lockBalances(tx, change.userId);
  const before = change.account === "weekly_ticket" ? current.weeklyTicketKobo : current.walletKobo;
  if (change.deltaKobo === 0) return before;
  const after = before + change.deltaKobo;
  if (after < 0) throw new AppError("Insufficient balance", 400, "insufficient_funds");

  await tx.user.update({
    where: { id: change.userId },
    data: change.account === "weekly_ticket" ? { weeklyTicketKobo: after } : { walletKobo: after },
  });
  await tx.transaction.create({
    data: {
      userId: change.userId,
      type: change.type,
      account: change.account,
      amountKobo: change.deltaKobo,
      balanceAfterKobo: after,
      reference: change.reference ?? null,
      description: change.description,
      orderId: change.orderId ?? null,
      topupId: change.topupId ?? null,
      createdById: change.createdById ?? null,
    },
  });
  return after;
}

/**
 * Integrity check: compare each person's stored balances with the sum of
 * their ledger. Returns the people whose numbers don't match (should be none).
 */
export async function checkLedger(tx: Tx) {
  return tx.$queryRaw<
    { id: string; full_name: string; weekly_ticket_kobo: number; ledger_weekly: number; wallet_kobo: number; ledger_wallet: number }[]
  >`
    SELECT u.id, u.full_name, u.weekly_ticket_kobo, u.wallet_kobo,
           COALESCE(SUM(t.amount_kobo) FILTER (WHERE t.account = 'weekly_ticket'), 0)::int AS ledger_weekly,
           COALESCE(SUM(t.amount_kobo) FILTER (WHERE t.account = 'wallet'), 0)::int AS ledger_wallet
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id
    GROUP BY u.id
    HAVING u.weekly_ticket_kobo <> COALESCE(SUM(t.amount_kobo) FILTER (WHERE t.account = 'weekly_ticket'), 0)
        OR u.wallet_kobo        <> COALESCE(SUM(t.amount_kobo) FILTER (WHERE t.account = 'wallet'), 0)`;
}
