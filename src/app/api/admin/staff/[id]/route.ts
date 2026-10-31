/**
 * PATCH  /api/admin/staff/:id { role } | { status } — change role or account status.
 * DELETE /api/admin/staff/:id — remove from the directory (history kept).
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { uuidParam } from "@/lib/validation";
import { changeRole, changeStatus, removeStaff } from "@/server/staff";

const schema = z.union([
  z.object({ role: z.enum(["staff", "operator", "admin"]) }),
  z.object({ status: z.enum(["active", "suspended", "deactivated"]) }),
]);

export const PATCH = route({ auth: "admin", body: schema }, async ({ user, body, params }) => {
  const id = uuidParam.parse(params.id);
  const updated = "role" in body ? await changeRole(id, body.role, user.id) : await changeStatus(id, body.status, user.id);
  return { user: { id: updated.id, role: updated.role, status: updated.status } };
});

export const DELETE = route({ auth: "admin" }, async ({ user, params }) => {
  await removeStaff(uuidParam.parse(params.id), user.id);
});
