/**
 * Money helpers.
 *
 * Every amount in the database and in the API is an integer number of KOBO
 * (₦1 = 100 kobo). Convert to naira only for display, using `formatMoney`.
 * Components never write "₦" themselves (convention #24).
 */

/** Naira (as typed by a person) -> kobo. Rounds to the nearest kobo. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/** Kobo -> naira number (for form default values only, never for maths). */
export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/**
 * Display format, identical to v63: "₦2,500", "₦1,250.50".
 * Negative values show a leading minus: "-₦2,000".
 */
export function formatMoney(kobo: number): string {
  const naira = Math.abs(kobo) / 100;
  const text = naira.toLocaleString("en-NG", { maximumFractionDigits: 2 });
  return `${kobo < 0 ? "-" : ""}₦${text}`;
}

/**
 * Weekly Ticket allocation rule (unchanged from v63):
 * ₦2,000 to ₦5,000 in ₦500 steps.
 */
export const WEEKLY_TICKET_OPTIONS_KOBO = [2000, 2500, 3000, 3500, 4000, 4500, 5000].map(nairaToKobo);

export function isValidWeeklyTicketAmount(kobo: number): boolean {
  return WEEKLY_TICKET_OPTIONS_KOBO.includes(kobo);
}

/** Smallest and largest wallet top-up a staff member may request. */
export const TOPUP_MIN_KOBO = nairaToKobo(100);
export const TOPUP_MAX_KOBO = nairaToKobo(500_000);

/**
 * How an order is paid: Weekly Ticket first, then Personal Wallet.
 * Returns null when the two balances together can't cover the order.
 * This is the exact rule from v63's `place_order` database function.
 */
export function splitPayment(
  totalKobo: number,
  weeklyTicketKobo: number,
  walletKobo: number,
): { fromWeeklyTicket: number; fromWallet: number } | null {
  if (totalKobo < 0) throw new Error("Order total cannot be negative");
  const weekly = Math.max(0, weeklyTicketKobo);
  const wallet = Math.max(0, walletKobo);
  if (weekly + wallet < totalKobo) return null;
  const fromWeeklyTicket = Math.min(weekly, totalKobo);
  return { fromWeeklyTicket, fromWallet: totalKobo - fromWeeklyTicket };
}
