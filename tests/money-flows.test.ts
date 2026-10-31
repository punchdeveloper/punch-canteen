/**
 * Integration tests on a real Postgres test database (punch_canteen_test).
 * They exercise the money flows end to end through the service layer and
 * check the ledger invariant after every scenario:
 *   sum(transactions per person and account) == stored balance.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkLedger } from "@/server/ledger";
import { advanceOrder, placeOrder } from "@/server/orders";
import { confirmTopup, creditWeeklyTickets, expirePreviousMonthWeeklyTickets, rejectTopup, requestTopup, resetBalances } from "@/server/wallet";
import { advanceGuestOrder, confirmGuestPayment, createGuestOrder, lookupGuestOrder, rejectGuestPayment } from "@/server/guest-orders";
import { submitFoodReview } from "@/server/reviews";
import { changeRole, changeStatus, removeStaff } from "@/server/staff";
import { clearTestData } from "@/server/maintenance";

const k = (naira: number) => naira * 100;
let admin: { id: string };
let staff: { id: string };
let rice: { id: number };
let zobo: { id: number };

async function wipe() {
  await db.$executeRawUnsafe(
    `TRUNCATE audit_logs, reviews, experience_reviews, chat_read_receipts, chat_messages, transactions, order_items, orders,
     guest_order_items, guest_orders, wallet_topups, weekly_ticket_expiries, login_tokens, sessions, canteen_settings, menu_items, users
     RESTART IDENTITY CASCADE`,
  );
}

beforeEach(async () => {
  await wipe();
  admin = await db.user.create({ data: { fullName: "Master Admin", email: "master@test.local", role: "admin", status: "active", isMaster: true } });
  staff = await db.user.create({ data: { fullName: "Test Staff", email: "staff@test.local", role: "staff", status: "active" } });
  rice = await db.menuItem.create({ data: { name: "Ofada rice & stew", priceKobo: k(2000), category: "Meals" } });
  zobo = await db.menuItem.create({ data: { name: "Zobo drink", priceKobo: k(800), category: "Drinks" } });
});

afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

const balances = async (id: string) => db.user.findUniqueOrThrow({ where: { id }, select: { weeklyTicketKobo: true, walletKobo: true } });
const ledgerOk = async () => expect(await db.$transaction((tx) => checkLedger(tx))).toEqual([]);

describe("ordering", () => {
  it("pays from Weekly Ticket first, then wallet, and stores both amounts on the order", async () => {
    await creditWeeklyTickets([staff.id], k(2000), admin.id);
    const t = await requestTopup(staff.id, k(1000));
    await confirmTopup(t.id, admin.id);

    const order = await placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 1 }, { menuItemId: zobo.id, quantity: 1 }]);
    expect(order.totalKobo).toBe(k(2800));
    expect(order.weeklyTicketKobo).toBe(k(2000));
    expect(order.walletKobo).toBe(k(800));
    expect(await balances(staff.id)).toEqual({ weeklyTicketKobo: 0, walletKobo: k(200) });
    await ledgerOk();
  });

  it("refuses an order the balances can't cover, and charges nothing", async () => {
    await creditWeeklyTickets([staff.id], k(2000), admin.id);
    await expect(placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 2 }])).rejects.toThrow(/Insufficient balance/);
    expect(await balances(staff.id)).toEqual({ weeklyTicketKobo: k(2000), walletKobo: 0 });
    expect(await db.order.count()).toBe(0);
  });

  it("uses database prices and refuses unavailable items", async () => {
    await creditWeeklyTickets([staff.id], k(5000), admin.id);
    await db.menuItem.update({ where: { id: zobo.id }, data: { available: false } });
    await expect(placeOrder(staff.id, [{ menuItemId: zobo.id, quantity: 1 }])).rejects.toThrow(/no longer available/);
  });

  it("can't overspend when two orders race for the same balance", async () => {
    await creditWeeklyTickets([staff.id], k(2000), admin.id);
    const results = await Promise.allSettled([
      placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 1 }]),
      placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 1 }]),
      placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 1 }]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balances(staff.id)).toEqual({ weeklyTicketKobo: 0, walletKobo: 0 });
    await ledgerOk();
  });

  it("moves received -> ready -> collected only, never backwards or twice", async () => {
    await creditWeeklyTickets([staff.id], k(2000), admin.id);
    const order = await placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 1 }]);
    await expect(advanceOrder(order.id, "collected", admin.id)).rejects.toThrow(/already received/);
    await advanceOrder(order.id, "ready", admin.id);
    await expect(advanceOrder(order.id, "ready", admin.id)).rejects.toThrow(/already ready/);
    const done = await advanceOrder(order.id, "collected", admin.id);
    expect(done.status).toBe("collected");
    expect(done.collectedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityType: "order" } })).toBe(2);
  });
});

describe("wallet top-ups", () => {
  it("credits only on confirm, never twice, and records a reject reason", async () => {
    const a = await requestTopup(staff.id, k(1000));
    const b = await requestTopup(staff.id, k(500));
    await confirmTopup(a.id, admin.id);
    await expect(confirmTopup(a.id, admin.id)).rejects.toThrow(/already been processed/);
    const rejected = await rejectTopup(b.id, admin.id, "No transfer received");
    expect(rejected.rejectionReason).toBe("No transfer received");
    await expect(confirmTopup(b.id, admin.id)).rejects.toThrow(/already been processed/);
    expect((await balances(staff.id)).walletKobo).toBe(k(1000));
    await ledgerOk();
  });

  it("rejects silly amounts", async () => {
    await expect(requestTopup(staff.id, k(50))).rejects.toThrow(/at least/);
    await expect(requestTopup(staff.id, k(600_000))).rejects.toThrow(/can't be more/);
  });
});

describe("Weekly Ticket", () => {
  it("only allows ₦2,000–₦5,000 in ₦500 steps and credits everyone or no one", async () => {
    await expect(creditWeeklyTickets([staff.id], k(2300), admin.id)).rejects.toThrow(/₦500 steps/);
    const suspended = await db.user.create({ data: { fullName: "Suspended", email: "s@test.local", status: "suspended" } });
    await expect(creditWeeklyTickets([staff.id, suspended.id], k(2000), admin.id)).rejects.toThrow(/can't receive/);
    expect((await balances(staff.id)).weeklyTicketKobo).toBe(0);
    const r = await creditWeeklyTickets([staff.id, staff.id, admin.id], k(2500), admin.id);
    expect(r).toEqual({ staffProcessed: 2, totalAllocatedKobo: k(5000) });
  });

  it("expires unused Weekly Ticket at month end, once, and records it in the ledger", async () => {
    await creditWeeklyTickets([staff.id], k(3000), admin.id);
    const wallet = await requestTopup(staff.id, k(700));
    await confirmTopup(wallet.id, admin.id);
    const now = new Date("2026-11-01T00:05:00+01:00");
    const first = await expirePreviousMonthWeeklyTickets(now);
    expect(first).toMatchObject({ usersExpired: 1, totalForfeitedKobo: k(3000) });
    expect(await balances(staff.id)).toEqual({ weeklyTicketKobo: 0, walletKobo: k(700) }); // wallet untouched
    const again = await expirePreviousMonthWeeklyTickets(now);
    expect(again.usersExpired).toBe(0);
    expect(await db.transaction.count({ where: { type: "weekly_ticket_expiry" } })).toBe(1);
    await ledgerOk();
  });

  it("admin balance resets are ledgered too", async () => {
    await creditWeeklyTickets([staff.id], k(2000), admin.id);
    expect(await resetBalances({ userId: null, weekly: true, wallet: false, actorId: admin.id })).toBe(1);
    expect((await balances(staff.id)).weeklyTicketKobo).toBe(0);
    await ledgerOk();
  });
});

describe("guest orders", () => {
  it("issues a ticket only after payment is confirmed, then runs the kitchen steps", async () => {
    const g = await createGuestOrder({ guestName: "Visitor", phoneNumber: "08031234567", lines: [{ menuItemId: zobo.id, quantity: 2 }], ipHash: null });
    expect(g.totalKobo).toBe(k(1600));
    await expect(advanceGuestOrder(g.id, "ready", admin.id)).rejects.toThrow(/not been confirmed/);
    const confirmed = await confirmGuestPayment(g.id, admin.id);
    expect(confirmed.ticketNumber).toMatch(/^GUEST-PCH-/);
    await advanceGuestOrder(g.id, "ready", admin.id);
    await advanceGuestOrder(g.id, "collected", admin.id);
    const found = await lookupGuestOrder(g.paymentReference.toLowerCase());
    expect(found?.orderStatus).toBe("collected");
  });

  it("can be rejected with a reason", async () => {
    const g = await createGuestOrder({ guestName: "Visitor", phoneNumber: "08031234567", lines: [{ menuItemId: rice.id, quantity: 1 }], ipHash: null });
    await rejectGuestPayment(g.id, admin.id, "Transfer not found");
    expect((await lookupGuestOrder(g.paymentReference))?.rejectionReason).toBe("Transfer not found");
    await expect(confirmGuestPayment(g.id, admin.id)).rejects.toThrow(/already been processed/);
  });
});

describe("reviews", () => {
  it("only accepts food reviews for meals the person has ordered", async () => {
    await expect(submitFoodReview(staff.id, { menuItemId: rice.id, rating: 5, comment: null })).rejects.toThrow(/order history/);
    await creditWeeklyTickets([staff.id], k(2000), admin.id);
    const order = await placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 1 }]);
    const review = await submitFoodReview(staff.id, { menuItemId: rice.id, rating: 4, comment: "Good" });
    expect(review.orderId).toBe(order.id);
  });
});

describe("staff protections", () => {
  it("protects the master admin and stops admins locking themselves out", async () => {
    const second = await db.user.create({ data: { fullName: "Second Admin", email: "admin2@test.local", role: "admin", status: "active" } });
    await expect(changeRole(admin.id, "staff", second.id)).rejects.toThrow(/master administrator cannot be demoted/);
    await expect(changeStatus(admin.id, "suspended", second.id)).rejects.toThrow(/master administrator/);
    await expect(removeStaff(admin.id, second.id)).rejects.toThrow(/master administrator/);
    await expect(changeRole(second.id, "operator", second.id)).rejects.toThrow(/your own Admin role/);
    await expect(removeStaff(second.id, second.id)).rejects.toThrow(/your own account/);
  });

  it("signs a suspended person out everywhere", async () => {
    await db.session.create({ data: { id: "hash-1", userId: staff.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    await changeStatus(staff.id, "suspended", admin.id);
    expect(await db.session.count({ where: { userId: staff.id } })).toBe(0);
  });
});

describe("maintenance", () => {
  it("clear test data keeps the ledger consistent (wallet kept as opening balance)", async () => {
    await creditWeeklyTickets([staff.id], k(2000), admin.id);
    const t = await requestTopup(staff.id, k(1000));
    await confirmTopup(t.id, admin.id);
    await placeOrder(staff.id, [{ menuItemId: rice.id, quantity: 1 }]);
    await clearTestData(admin.id, { resetWallet: false });
    expect(await db.order.count()).toBe(0);
    expect(await balances(staff.id)).toEqual({ weeklyTicketKobo: 0, walletKobo: k(1000) });
    await ledgerOk();
  });
});
