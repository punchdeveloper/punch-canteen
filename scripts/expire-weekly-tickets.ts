/**
 * Month-end Weekly Ticket expiry job.
 *
 * Forfeits every unused Weekly Ticket balance for the month that just ended
 * (Africa/Lagos). Personal Wallet is never touched. Safe to run more than
 * once — each person is expired at most once per month.
 *
 * On the droplet, run it from cron a few minutes after midnight Lagos time on
 * the 1st (Lagos is UTC+1 all year):
 *   5 23 28-31 * *  cd /srv/punch-canteen && [ "$(TZ=Africa/Lagos date +\%d)" = "01" ] && npm run job:expire-weekly-tickets
 * (see docs/DEPLOYMENT.md). This replaces v63's pg_cron job.
 *
 * Usage: npm run job:expire-weekly-tickets
 */
import "dotenv/config";
import { expirePreviousMonthWeeklyTickets } from "@/server/wallet";
import { formatMoney } from "@/lib/money";
import { db } from "@/lib/db";

async function main() {
  const r = await expirePreviousMonthWeeklyTickets();
  console.log(
    `[weekly-ticket-expiry] ${r.month.toISOString().slice(0, 7)}: ${r.usersExpired} people, ${formatMoney(r.totalForfeitedKobo)} forfeited`,
  );
}

main()
  .catch((err) => {
    console.error("[weekly-ticket-expiry] failed", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
