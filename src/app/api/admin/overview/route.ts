/**
 * GET /api/admin/overview — everything on the Admin portal: financial summary,
 * transaction log, review reports, staff directory with balances.
 */
import { route } from "@/lib/api";
import { loadAdminOverview } from "@/server/loaders";

export const GET = route({ auth: "admin" }, async () => ({ overview: await loadAdminOverview() }));
