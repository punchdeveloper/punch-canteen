"use client";
/**
 * Reviews (v63 "review" view): Food & Menu Review for meals the person has
 * ordered (checked on the server too), Canteen Experience review, and the
 * person's recent reviews. Guests can see the page; submitting asks them to
 * sign in, as in v63.
 */
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { PageHead, fmt } from "@/components/page-head";
import { apiSend, fetcher } from "@/lib/client/api";
import type { ReviewsData } from "@/server/loaders";

const RATING_OPTIONS = (
  <>
    <option value="5">5 — Excellent</option>
    <option value="4">4 — Good</option>
    <option value="3">3 — Average</option>
    <option value="2">2 — Poor</option>
    <option value="1">1 — Very poor</option>
  </>
);

const AREAS = [
  ["environmentRating", "Environment / Cleanliness"],
  ["restroomRating", "Restroom"],
  ["ambienceRating", "Ambience"],
  ["customerServiceRating", "Customer Service"],
  ["speedOfServiceRating", "Speed of Service"],
  ["foodPresentationRating", "Food Presentation"],
  ["overallRating", "Overall Experience"],
] as const;

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export function ReviewsView({ initial }: { initial: ReviewsData | null }) {
  const router = useRouter();
  const { me, toast } = useApp();
  const { data, mutate } = useSWR<{ reviews: ReviewsData }>(initial ? "/api/reviews" : null, fetcher, {
    fallbackData: initial ? { reviews: initial } : undefined,
  });
  const reviews = data?.reviews ?? { eligible: [], food: [], experience: [] };
  const [foodError, setFoodError] = useState("");
  const [expError, setExpError] = useState("");
  const [busy, setBusy] = useState<"food" | "exp" | null>(null);

  async function submitFood(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return router.push("/login?next=/reviews");
    const form = e.currentTarget;
    const f = new FormData(form);
    setFoodError("");
    setBusy("food");
    try {
      await apiSend("/api/reviews", "POST", {
        menuItemId: Number(f.get("menu_item_id")),
        rating: Number(f.get("rating")),
        comment: String(f.get("comment") || ""),
      });
      form.reset();
      await mutate();
      toast("Thank you — your review has been submitted");
    } catch (err) {
      setFoodError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submitExperience(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return router.push("/login?next=/reviews");
    const form = e.currentTarget;
    const f = new FormData(form);
    setExpError("");
    setBusy("exp");
    try {
      await apiSend("/api/experience-reviews", "POST", {
        ...Object.fromEntries(AREAS.map(([name]) => [name, Number(f.get(name))])),
        comment: String(f.get("comment") || ""),
      });
      form.reset();
      await mutate();
      toast("Thank you — your canteen experience review has been submitted");
    } catch (err) {
      setExpError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHead title="Review your canteen experience" sub="Rate a meal or tell us about the wider canteen experience." />
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">TWO WAYS TO SHARE FEEDBACK</span>
            <h2>What would you like to review?</h2>
          </div>
        </div>
        <p className="muted">Use Food &amp; Menu Review for a specific meal. Use Canteen Experience for the environment, restroom, ambience and service.</p>
      </div>

      <div className="review-grid">
        <form id="review-form" className="panel" style={{ margin: 0 }} onSubmit={submitFood}>
          <h2>Food &amp; Menu Review</h2>
          <label className="field">
            Menu item
            <select name="menu_item_id" required defaultValue="">
              <option value="">Choose a menu item</option>
              {reviews.eligible.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">Only meals from your order history are available for food reviews.</p>
          <label className="field">
            Rating
            <select name="rating" required defaultValue="5">
              {RATING_OPTIONS}
            </select>
          </label>
          <label className="field">
            Comment
            <textarea name="comment" rows={5} maxLength={500} placeholder="Tell us what worked or what should improve" />
          </label>
          <div id="review-error" className="form-error" role="alert" style={{ marginBottom: 10 }}>
            {foodError}
          </div>
          <button className="btn full" type="submit" disabled={busy === "food"}>
            {busy === "food" ? "Submitting…" : "Submit food review"}
          </button>
        </form>

        <form id="experience-review-form" className="panel" style={{ margin: 0 }} onSubmit={submitExperience}>
          <h2>Canteen Experience</h2>
          <p className="muted">Rate each area from 1 (Very poor) to 5 (Excellent).</p>
          {AREAS.map(([name, label]) => (
            <label className="field" key={name}>
              {label}
              <select name={name} required defaultValue="5">
                {RATING_OPTIONS}
              </select>
            </label>
          ))}
          <label className="field">
            Comment
            <textarea name="comment" rows={4} maxLength={500} placeholder="What should the canteen keep doing or improve?" />
          </label>
          <div id="experience-review-error" className="form-error" role="alert" style={{ marginBottom: 10 }}>
            {expError}
          </div>
          <button className="btn full" type="submit" disabled={busy === "exp"}>
            {busy === "exp" ? "Submitting…" : "Submit experience review"}
          </button>
        </form>
      </div>

      <div className="review-grid" style={{ marginTop: 20 }}>
        <div className="panel" style={{ margin: 0 }}>
          <h2>Your recent food reviews</h2>
          <div className="review-history">
            {reviews.food.length ? (
              reviews.food.map((r) => (
                <div className="review-item" key={r.id}>
                  <div className="panel-head">
                    <strong>{r.menuName}</strong>
                    <span className="review-score" aria-label={`${r.rating} out of 5`}>
                      {stars(r.rating)}
                    </span>
                  </div>
                  <p>{r.comment || "No comment added."}</p>
                  <p className="muted">{fmt.dateTime(r.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="muted">You have not submitted a food review yet.</p>
            )}
          </div>
        </div>
        <div className="panel" style={{ margin: 0 }}>
          <h2>Your recent experience reviews</h2>
          <div className="review-history">
            {reviews.experience.length ? (
              reviews.experience.map((r) => (
                <div className="review-item" key={r.id}>
                  <div className="panel-head">
                    <strong>Overall Experience</strong>
                    <span className="review-score" aria-label={`${r.overallRating} out of 5`}>
                      {stars(r.overallRating)}
                    </span>
                  </div>
                  <p>{r.comment || "No comment added."}</p>
                  <p className="muted">
                    Environment {r.environmentRating}/5 · Restroom {r.restroomRating}/5 · Service {r.customerServiceRating}/5
                  </p>
                  <p className="muted">{fmt.dateTime(r.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="muted">You have not submitted a canteen experience review yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
