/**
 * Screen loaders.
 *
 * Each function returns exactly what one screen needs, as plain JSON (dates
 * become ISO strings). The same loader feeds:
 *   * the server-rendered page (so data is there on first paint / refresh —
 *     fixes v63's "page comes back empty after a refresh", N2), and
 *   * the matching GET API that the page polls for live updates (fixes N1/N3:
 *     the Operator queue and staff order status update on their own).
 */
import "server-only";
import { menuPhotoUrl, getSettings, listAllMenu, listAvailableMenu } from "@/server/menu";
import { listMyOrders, listOperatorQueue } from "@/server/orders";
import { listMyTopups, listPendingTopups } from "@/server/wallet";
import { listGuestOrdersForOperator } from "@/server/guest-orders";
import { listConversation, listConversationsForOperator, operatorUnreadCount, staffUnreadCount } from "@/server/chat";
import { listMyExperienceReviews, listMyFoodReviews, reviewableItems } from "@/server/reviews";
import { experienceReport, financialSummary, foodReviewReport, recentTransactions } from "@/server/reports";
import { listDirectory } from "@/server/staff";
import { maintenanceEnabled } from "@/server/maintenance";
import type { SessionUser } from "@/lib/auth/session";

/** JSON round-trip: Dates -> ISO strings, so data can cross to client components. */
export const plain = <T>(v: T): Jsonify<T> => JSON.parse(JSON.stringify(v));
type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

// ---------------------------------------------------------------------------
// Public / staff
// ---------------------------------------------------------------------------

export async function loadMenu() {
  const [items, settings] = await Promise.all([listAvailableMenu(), getSettings()]);
  return {
    items: items.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      priceKobo: m.priceKobo,
      allergens: m.allergens,
      category: m.category,
      imageUrl: menuPhotoUrl(m.imageFile),
    })),
    todaysSpecialId: settings.todaysSpecialItemId,
  };
}
export type MenuData = Awaited<ReturnType<typeof loadMenu>>;
export type MenuItemDto = MenuData["items"][number];

/** Header/shell info for a signed-in person, refreshed every few seconds. */
export async function loadMe(user: SessionUser) {
  const staffSide = user.role === "staff";
  const [staffUnread, opUnread] = await Promise.all([
    staffUnreadCount(user.id),
    staffSide ? Promise.resolve(0) : operatorUnreadCount(user.id),
  ]);
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      weeklyTicketKobo: user.weeklyTicketKobo,
      walletKobo: user.walletKobo,
    },
    staffUnreadCount: staffUnread,
    operatorUnreadCount: opUnread,
  };
}
export type MeData = Awaited<ReturnType<typeof loadMe>>;

export async function loadMyOrders(userId: string) {
  const orders = await listMyOrders(userId);
  return plain(
    orders.map((o) => ({
      id: o.id,
      totalKobo: o.totalKobo,
      weeklyTicketKobo: o.weeklyTicketKobo,
      walletKobo: o.walletKobo,
      status: o.status,
      ticketNumber: o.ticketNumber,
      createdAt: o.createdAt,
      readyAt: o.readyAt,
      collectedAt: o.collectedAt,
      items: o.items.map((i) => ({ name: i.itemName, quantity: i.quantity })),
    })),
  );
}
export type MyOrder = Awaited<ReturnType<typeof loadMyOrders>>[number];

export async function loadAccount(userId: string) {
  const [topups, settings] = await Promise.all([listMyTopups(userId), getSettings()]);
  return plain({
    topups: topups.map((t) => ({
      id: t.id,
      amountKobo: t.amountKobo,
      reference: t.reference,
      status: t.status,
      rejectionReason: t.rejectionReason,
      requestedAt: t.requestedAt,
    })),
    bank: { name: settings.bankName, accountNumber: settings.bankAccountNumber, accountName: settings.bankAccountName },
  });
}
export type AccountData = Awaited<ReturnType<typeof loadAccount>>;

export async function loadBank() {
  const s = await getSettings();
  return { name: s.bankName, accountNumber: s.bankAccountNumber, accountName: s.bankAccountName };
}

export async function loadReviews(userId: string) {
  const [eligible, food, experience] = await Promise.all([
    reviewableItems(userId),
    listMyFoodReviews(userId),
    listMyExperienceReviews(userId),
  ]);
  return plain({
    eligible,
    food: food.map((r) => ({ id: r.id, menuName: r.menuItem.name, rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
    experience,
  });
}
export type ReviewsData = Awaited<ReturnType<typeof loadReviews>>;

export async function loadMyChat(userId: string) {
  const msgs = await listConversation(userId);
  return plain(msgs.map((m) => ({ id: m.id, senderRole: m.senderRole, message: m.message, createdAt: m.createdAt })));
}
export type ChatMessageDto = Awaited<ReturnType<typeof loadMyChat>>[number];

// ---------------------------------------------------------------------------
// Operator
// ---------------------------------------------------------------------------

export async function loadOperatorOverview() {
  const [orders, topups, guests] = await Promise.all([listOperatorQueue(), listPendingTopups(), listGuestOrdersForOperator()]);
  return plain({
    orders: orders.map((o) => ({
      id: o.id,
      name: o.user.fullName,
      totalKobo: o.totalKobo,
      status: o.status,
      ticketNumber: o.ticketNumber,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({ name: i.itemName, quantity: i.quantity })),
    })),
    topups: topups.map((t) => ({
      id: t.id,
      name: t.user.fullName,
      amountKobo: t.amountKobo,
      reference: t.reference,
      requestedAt: t.requestedAt,
    })),
    guestOrders: guests.map((g) => ({
      id: g.id,
      guestName: g.guestName,
      phoneNumber: g.phoneNumber,
      totalKobo: g.totalKobo,
      paymentReference: g.paymentReference,
      paymentStatus: g.paymentStatus,
      orderStatus: g.orderStatus,
      ticketNumber: g.ticketNumber,
      createdAt: g.createdAt,
      items: g.items.map((i) => ({ name: i.itemName, quantity: i.quantity })),
    })),
  });
}
export type OperatorOverview = Awaited<ReturnType<typeof loadOperatorOverview>>;

export async function loadOperatorChat(viewerId: string, activeUserId: string | null) {
  const conversations = await listConversationsForOperator(viewerId);
  // Default to the most recent conversation (v63 opened the oldest — N9).
  const active = activeUserId && conversations.some((c) => c.user_id === activeUserId) ? activeUserId : conversations[0]?.user_id ?? null;
  const messages = active ? await listConversation(active) : [];
  return plain({
    conversations: conversations.map((c) => ({ userId: c.user_id, name: c.name, preview: c.preview, lastAt: c.last_at, unread: c.unread })),
    activeUserId: active,
    messages: messages.map((m) => ({ id: m.id, senderRole: m.senderRole, message: m.message, createdAt: m.createdAt })),
  });
}
export type OperatorChatData = Awaited<ReturnType<typeof loadOperatorChat>>;

export async function loadMenuManager() {
  const [items, settings] = await Promise.all([listAllMenu(), getSettings()]);
  return {
    items: items.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      priceKobo: m.priceKobo,
      allergens: m.allergens,
      category: m.category,
      imageUrl: menuPhotoUrl(m.imageFile),
      available: m.available,
    })),
    todaysSpecialId: settings.todaysSpecialItemId,
  };
}
export type MenuManagerData = Awaited<ReturnType<typeof loadMenuManager>>;

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function loadAdminOverview() {
  const [summary, transactions, foodReviews, experience, directory] = await Promise.all([
    financialSummary(),
    recentTransactions(),
    foodReviewReport(),
    experienceReport(),
    listDirectory(),
  ]);
  return plain({ summary, transactions, foodReviews, experience, directory, maintenanceEnabled: maintenanceEnabled() });
}
export type AdminOverview = Awaited<ReturnType<typeof loadAdminOverview>>;

