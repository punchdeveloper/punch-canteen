/** PUT /api/operator/todays-special { menuItemId } — feature a meal on the Home page. */
import { z } from "zod";
import { route } from "@/lib/api";
import { setTodaysSpecial } from "@/server/menu";

export const PUT = route(
  { auth: "operator", body: z.object({ menuItemId: z.coerce.number().int().positive("Please choose a meal") }) },
  async ({ user, body }) => {
    const item = await setTodaysSpecial(body.menuItemId, user.id);
    return { item: { id: item.id, name: item.name } };
  },
);
