/**
 * Personal Wallet top-ups and Weekly Ticket allocation.
 *
 * Top-up flow (unchanged from v63): staff transfer money to the canteen's
 * bank account, then submit the amount. An operator checks the bank and either
 * confirms (wallet credited in full) or rejects (nothing credited). New: a
 * rejection can carry a reason the staff member sees.
 *
 * Weekly Ticket: admins credit ₦2,000–₦5,000 in ₦500 steps to one person or
 * many at once. Unused Weekly Ticket expires at the end of each month
 * (Africa/Lagos) — see `expirePreviousMonthWeeklyTickets`.
 */
import "server-only";
import { db, type Tx } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { formatMoney, isValidWeeklyTicketAmount, TOPUP_MAX_KOBO, TOPUP_MIN_KOBO } from "@/lib/money";
import { makeReference } from "@/lib/references";
import { audit } from "@/lib/audit";
import { applyBalanceChange, lockBalances } from "@/server/ledger";

// ---------------------------------------------------------------------------
// Top-ups
// ---------------------------------------------------------------------------

export async function requestTopup(userId: string, amountKobo: number) {
  if (!Number.isInteger(amountKobo) || amountKobo < TOPUP_MIN_KOBO) {
    throw new AppError(`Enter the amount you transferred (at least ${formatMoney(TOPUP_MIN_KOBO)}).`);
  }
  if (amountKobo > TOPUP_MAX_KOBO) {
    throw new AppError(`A single top-up can't be more than ${formatMoney(TOPUP_MAX_KOBO)}.`);
  }
  // Stop accidental double submissions piling up.
  const pending = await db.walletTopup.count({ where: { userId, status: "pending" } });
  if (pending >= 5) {
    throw new AppError("You already have 5 top-ups waiting for confirmation. Please wait for the canteen to confirm them.");
  }
  return db.walletTopup.create({ data: { userId, amountKobo, reference: makeReference("TOPUP") } });
}

export function listMyTopups(userId: string) {
  return db.walletTopup.findMany({ where: { userId }, orderBy: { requestedAt: "desc" }, take: 10 });
}

export function listPendingTopups() {
  return db.walletTopup.findMany({
    where: { status: "pending" },
    orderBy: { requestedAt: "asc" },
    include: { user: { select: { fullName: true, email: true } } },
  });
}

/** Lock a top-up row and make sure it is still pending. */
async function lockPendingTopup(tx: Tx, topupId: number) {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT status FROM wallet_topups WHERE id = ${topupId} FOR UPDATE`;
  if (!rows[0]) throw notFound("Top-up request");
  if (rows[0].status !== "pending") throw new AppError("This top-up has already been processed.", 409, "stale");
}

export async function confirmTopup(topupId: number, actorId: string) {
  return db.$transaction(async (tx) => {
    await lockPendingTopup(tx, topupId);
    const topup = await tx.walletTopup.update({
      where: { id: topupId },
      data: { status: "confirmed", decidedById: actorId, decidedAt: new Date() },
      include: { user: { select: { fullName: true } } },
    });
    await applyBalanceChange(tx, {
      userId: topup.userId,
      account: "wallet",
      deltaKobo: topup.amountKobo,
      type: "wallet_topup",
      description: "Personal Wallet top-up",
      reference: topup.reference,
      topupId: topup.id,
      createdById: actorId,
    });
    await audit(
      {
        actorId,
        action: "topup.confirm",
        entityType: "wallet_topup",
        entityId: topup.id,
        message: `Confirmed ${formatMoney(topup.amountKobo)} top-up for ${topup.user.fullName}`,
        meta: { reference: topup.reference, amountKobo: topup.amountKobo },
      },
      tx,
    );
    return topup;
  });
}

export async function rejectTopup(topupId: number, actorId: string, reason: string | null) {
  return db.$transaction(async (tx) => {
    await lockPendingTopup(tx, topupId);
    const topup = await tx.walletTopup.update({
      where: { id: topupId },
      data: { status: "rejected", decidedById: actorId, decidedAt: new Date(), rejectionReason: reason || null },
      include: { user: { select: { fullName: true } } },
    });
    await audit(
      {
        actorId,
        action: "topup.reject",
        entityType: "wallet_topup",
        entityId: topup.id,
        message: `Rejected ${formatMoney(topup.amountKobo)} top-up for ${topup.user.fullName}`,
        meta: { reference: topup.reference, reason },
      },
      tx,
    );
    return topup;
  });
}

// ---------------------------------------------------------------------------
// Weekly Ticket
// ---------------------------------------------------------------------------

/**
 * Credit the same Weekly Ticket amount to one or more people in a single
 * database transaction (all succeed or none do). Duplicate ids are ignored.
 */
export async function creditWeeklyTickets(userIds: string[], amountKobo: number, actorId: string) {
  if (!isValidWeeklyTicketAmount(amountKobo)) {
    throw new AppError("Weekly ticket must be between ₦2,000 and ₦5,000 in ₦500 steps");
  }
  const ids = [...new Set(userIds)];
  if (!ids.length) throw new AppError("No staff members selected");

  return db.$transaction(async (tx) => {
    const people = await tx.user.findMany({
      where: { id: { in: ids }, removedAt: null, status: { in: ["active", "invited"] } },
      select: { id: true, fullName: true },
    });
    if (people.length !== ids.length) {
      throw new AppError("Some selected people can't receive a Weekly Ticket (removed, suspended or deactivated). Refresh and try again.");
    }
    const reference = makeReference("WEEKLY");
    for (const p of people) {
      await applyBalanceChange(tx, {
        userId: p.id,
        account: "weekly_ticket",
        deltaKobo: amountKobo,
        type: "weekly_ticket_credit",
        description: "Weekly Ticket allocation",
        reference,
        createdById: actorId,
      });
    }
    await audit(
      {
        actorId,
        action: "weekly_ticket.credit",
        entityType: "user",
        entityId: ids.length === 1 ? ids[0] : null,
        message: `Credited ${formatMoney(amountKobo)} Weekly Ticket to ${people.length} ${people.length === 1 ? "person" : "people"}`,
        meta: { amountKobo, userIds: ids, reference },
      },
      tx,
    );
    return { staffProcessed: people.length, totalAllocatedKobo: people.length * amountKobo };
  });
}

/** First day of the previous month in Lagos, e.g. 2026-10-01 when run in November. */
export function previousLagosMonth(now = new Date()): Date {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(m === 1 ? y - 1 : y, m === 1 ? 11 : m - 2, 1));
}

/**
 * Month-end rule (unchanged from v63): every unused Weekly Ticket balance is
 * forfeited at the start of a new month. Personal Wallet is never touched.
 * Safe to run more than once: a person is only expired once per month.
 * New: the forfeit is written to the ledger so balances still add up.
 */
export async function expirePreviousMonthWeeklyTickets(now = new Date()) {
  const month = previousLagosMonth(now);
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const holders = await db.user.findMany({ where: { weeklyTicketKobo: { gt: 0 } }, select: { id: true } });
  let usersExpired = 0;
  let totalForfeitedKobo = 0;

  for (const { id } of holders) {
    await db.$transaction(async (tx) => {
      const already = await tx.weeklyTicketExpiry.findUnique({ where: { userId_expiryMonth: { userId: id, expiryMonth: month } } });
      if (already) return;
      const { weeklyTicketKobo } = await lockBalances(tx, id);
      if (weeklyTicketKobo <= 0) return;
      await tx.weeklyTicketExpiry.create({ data: { userId: id, expiryMonth: month, amountKobo: weeklyTicketKobo } });
      await applyBalanceChange(tx, {
        userId: id,
        account: "weekly_ticket",
        deltaKobo: -weeklyTicketKobo,
        type: "weekly_ticket_expiry",
        description: `Unused Weekly Ticket expired — ${label}`,
      });
      usersExpired += 1;
      totalForfeitedKobo += weeklyTicketKobo;
    });
  }
  await audit({
    actorId: null,
    action: "weekly_ticket.expire",
    entityType: "system",
    message: `Month-end expiry for ${label}: ${usersExpired} people, ${formatMoney(totalForfeitedKobo)} forfeited`,
    meta: { month: month.toISOString().slice(0, 10), usersExpired, totalForfeitedKobo },
  });
  return { usersExpired, totalForfeitedKobo, month };
}

/**
 * Admin balance reset (System Maintenance). v63 changed balances without any
 * record; here every reset is a ledger entry plus an audit log.
 * `userId` null = every Staff-role account (same scope as v63).
 */
export async function resetBalances(opts: { userId: string | null; weekly: boolean; wallet: boolean; actorId: string }) {
  if (!opts.weekly && !opts.wallet) throw new AppError("Select Weekly Ticket or Personal Wallet to reset");
  const targets = await db.user.findMany({
    where: opts.userId ? { id: opts.userId } : { role: "staff" },
    select: { id: true },
  });
  if (opts.userId && !targets.length) throw notFound("Staff account");

  let changed = 0;
  await db.$transaction(async (tx) => {
    for (const { id } of targets) {
      const b = await lockBalances(tx, id);
      let touched = false;
      if (opts.weekly && b.weeklyTicketKobo !== 0) {
        await applyBalanceChange(tx, {
          userId: id, account: "weekly_ticket", deltaKobo: -b.weeklyTicketKobo,
          type: "balance_reset", description: "Weekly Ticket reset by Admin", createdById: opts.actorId,
        });
        touched = true;
      }
      if (opts.wallet && b.walletKobo !== 0) {
        await applyBalanceChange(tx, {
          userId: id, account: "wallet", deltaKobo: -b.walletKobo,
          type: "balance_reset", description: "Personal Wallet reset by Admin", createdById: opts.actorId,
        });
        touched = true;
      }
      if (touched) changed += 1;
    }
    await audit(
      {
        actorId: opts.actorId,
        action: "balances.reset",
        entityType: "user",
        entityId: opts.userId,
        message: `Reset ${[opts.weekly && "Weekly Ticket", opts.wallet && "Personal Wallet"].filter(Boolean).join(" and ")} for ${opts.userId ? "one account" : "all staff accounts"} (${changed} changed)`,
        meta: { weekly: opts.weekly, wallet: opts.wallet, changed },
      },
      tx,
    );
  });
  return changed;
}
