/**
 * GET  /api/reviews — meals I can review + my recent food and experience reviews.
 * POST /api/reviews { menuItemId, rating, comment? } — food review for a meal
 *      I have ordered (checked on the server).
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { optionalText, rating } from "@/lib/validation";
import { submitFoodReview } from "@/server/reviews";
import { loadReviews } from "@/server/loaders";

export const GET = route({ auth: "signed-in" }, async ({ user }) => ({ reviews: await loadReviews(user.id) }));

const schema = z.object({ menuItemId: z.coerce.number().int().positive("Choose a menu item"), rating, comment: optionalText(500) });

export const POST = route({ auth: "signed-in", body: schema }, async ({ user, body }) => {
  await submitFoodReview(user.id, body);
});
