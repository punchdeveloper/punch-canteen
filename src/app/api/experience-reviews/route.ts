/** POST /api/experience-reviews — rate the wider canteen experience (7 areas, 1–5). */
import { z } from "zod";
import { route } from "@/lib/api";
import { optionalText, rating } from "@/lib/validation";
import { submitExperienceReview } from "@/server/reviews";

const schema = z.object({
  environmentRating: rating,
  restroomRating: rating,
  ambienceRating: rating,
  customerServiceRating: rating,
  speedOfServiceRating: rating,
  foodPresentationRating: rating,
  overallRating: rating,
  comment: optionalText(500),
});

export const POST = route({ auth: "signed-in", body: schema }, async ({ user, body }) => {
  await submitExperienceReview(user.id, body);
});
