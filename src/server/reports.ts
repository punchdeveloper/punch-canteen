/**
 * Admin read models: financial summary, transaction log and review reports.
 * Read-only — nothing here changes data, so nothing is audited.
 */
import "server-only";
import { db } from "@/lib/db";

/**
 * Overview cards. Same five figures as v63:
 * total order value (not cancelled), Weekly Ticket allocated, confirmed wallet
 * top-ups, total orders (not cancelled), and number of Staff-role accounts.
 */
export async function financialSummary() {
  const [orders, weekly, topups, staff] = await Promise.all([
    db.order.aggregate({ where: { status: { not: "cancelled" } }, _sum: { totalKobo: true }, _count: true }),
    db.transaction.aggregate({ where: { type: "weekly_ticket_credit" }, _sum: { amountKobo: true } }),
    db.walletTopup.aggregate({ where: { status: "confirmed" }, _sum: { amountKobo: true } }),
    db.user.count({ where: { role: "staff", removedAt: null } }),
  ]);
  return {
    totalOrderValueKobo: orders._sum.totalKobo ?? 0,
    totalWeeklyAllocationsKobo: weekly._sum.amountKobo ?? 0,
    totalConfirmedTopupsKobo: topups._sum.amountKobo ?? 0,
    totalOrders: orders._count,
    totalStaff: staff,
  };
}

/** Latest ledger entries with the person's name (Financial Oversight table). */
export async function recentTransactions(limit = 200) {
  const rows = await db.transaction.findMany({
    orderBy: { id: "desc" },
    take: limit,
    include: { user: { select: { fullName: true, email: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    createdAt: t.createdAt,
    staffName: t.user.fullName,
    staffEmail: t.user.email,
    type: t.type,
    account: t.account,
    amountKobo: t.amountKobo,
    balanceAfterKobo: t.balanceAfterKobo,
    reference: t.reference,
    description: t.description,
  }));
}

export async function foodReviewReport(limit = 250) {
  const rows = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { fullName: true, email: true } }, menuItem: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    staffName: r.user.fullName,
    staffEmail: r.user.email,
    menuItem: r.menuItem.name,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));
}

const AVG_FIELDS = [
  "overallRating", "environmentRating", "restroomRating", "ambienceRating",
  "customerServiceRating", "speedOfServiceRating", "foodPresentationRating",
] as const;

export async function experienceReport(limit = 250) {
  const [rows, agg] = await Promise.all([
    db.experienceReview.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { fullName: true, email: true } } },
    }),
    db.experienceReview.aggregate({
      _count: true,
      _avg: Object.fromEntries(AVG_FIELDS.map((f) => [f, true])) as Record<(typeof AVG_FIELDS)[number], true>,
    }),
  ]);
  const round = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
  return {
    summary: {
      totalReviews: agg._count,
      ...Object.fromEntries(AVG_FIELDS.map((f) => [f, round(agg._avg[f])])),
    } as { totalReviews: number } & Record<(typeof AVG_FIELDS)[number], number | null>,
    reviews: rows.map(({ user, ...r }) => ({ ...r, staffName: user.fullName, staffEmail: user.email })),
  };
}
