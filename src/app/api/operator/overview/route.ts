/**
 * GET /api/operator/overview — live order queue, pending top-ups and guest
 * orders. The Operator portal polls this every few seconds, so new orders and
 * top-ups appear without pressing Refresh (fixes N1).
 */
import { route } from "@/lib/api";
import { loadOperatorOverview } from "@/server/loaders";

export const GET = route({ auth: "operator" }, async () => ({ overview: await loadOperatorOverview() }));
