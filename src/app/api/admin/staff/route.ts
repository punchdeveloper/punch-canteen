/** POST /api/admin/staff { fullName, email, role } — pre-approve one employee. */
import { z } from "zod";
import { route } from "@/lib/api";
import { email, personName } from "@/lib/validation";
import { addStaff } from "@/server/staff";

const schema = z.object({ fullName: personName, email, role: z.enum(["staff", "operator", "admin"]) });

export const POST = route({ auth: "admin", body: schema }, async ({ user, body }) => {
  const added = await addStaff(body, user.id);
  return { user: { id: added.id, fullName: added.fullName } };
});
