/**
 * POST /api/admin/weekly-tickets { userIds: [...], amount } — credit the same
 * Weekly Ticket (₦2,000–₦5,000 in ₦500 steps) to one or many people at once.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { nairaAmount } from "@/lib/validation";
import { creditWeeklyTickets } from "@/server/wallet";

const schema = z.object({ userIds: z.array(z.uuid()).min(1, "Select at least one staff member").max(1000), amount: nairaAmount });

export const POST = route({ auth: "admin", body: schema }, async ({ user, body }) => creditWeeklyTickets(body.userIds, body.amount, user.id));
