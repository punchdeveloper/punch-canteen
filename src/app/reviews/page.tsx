/** Reviews — food and canteen experience. Guests can view; submitting needs sign-in. */
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { loadReviews } from "@/server/loaders";
import { ReviewsView } from "@/components/views/reviews-view";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const user = await requireStaff("/reviews", { allowGuest: true });
  return <ReviewsView initial={user ? await loadReviews(user.id) : null} />;
}
