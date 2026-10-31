/**
 * Food reviews and Canteen Experience reviews.
 *
 * Food reviews: a person may only review a meal that was in one of their own
 * orders (not cancelled). v63 checked this in the browser only; here the
 * server finds the order and stores its id with the review.
 */
import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** Menu items the person has ordered (eligible for a food review). */
export async function reviewableItems(userId: string) {
  const items = await db.orderItem.findMany({
    where: { order: { userId, status: { not: "cancelled" } }, menuItemId: { not: null } },
    select: { menuItemId: true, itemName: true },
    orderBy: { id: "desc" },
  });
  const seen = new Map<number, string>();
  for (const i of items) if (i.menuItemId && !seen.has(i.menuItemId)) seen.set(i.menuItemId, i.itemName);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function submitFoodReview(userId: string, input: { menuItemId: number; rating: number; comment: string | null }) {
  // The most recent eligible order containing this item.
  const line = await db.orderItem.findFirst({
    where: { menuItemId: input.menuItemId, order: { userId, status: { not: "cancelled" } } },
    orderBy: { id: "desc" },
    select: { orderId: true },
  });
  if (!line) throw new AppError("You can only review meals in your order history.");
  return db.review.create({
    data: { userId, orderId: line.orderId, menuItemId: input.menuItemId, rating: input.rating, comment: input.comment },
  });
}

export function listMyFoodReviews(userId: string) {
  return db.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { menuItem: { select: { name: true } } },
  });
}

export type ExperienceInput = {
  environmentRating: number;
  restroomRating: number;
  ambienceRating: number;
  customerServiceRating: number;
  speedOfServiceRating: number;
  foodPresentationRating: number;
  overallRating: number;
  comment: string | null;
};

export function submitExperienceReview(userId: string, input: ExperienceInput) {
  return db.experienceReview.create({ data: { userId, ...input } });
}

export function listMyExperienceReviews(userId: string) {
  return db.experienceReview.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 });
}
