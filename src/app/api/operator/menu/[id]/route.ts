/**
 * POST  /api/operator/menu/:id (multipart) — save changes (photo optional).
 * PATCH /api/operator/menu/:id { available } — mark available / unavailable.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { idParam } from "@/lib/validation";
import { readMenuForm } from "@/lib/menu-form";
import { setMenuAvailability, updateMenuItem } from "@/server/menu";

export const POST = route({ auth: "operator" }, async ({ user, req, params }) => {
  const { input, photo } = await readMenuForm(await req.formData());
  const item = await updateMenuItem(idParam.parse(params.id), input, photo, user.id);
  return { item: { id: item.id, name: item.name }, photoReplaced: !!photo };
});

export const PATCH = route({ auth: "operator", body: z.object({ available: z.boolean() }) }, async ({ user, body, params }) => {
  const item = await setMenuAvailability(idParam.parse(params.id), body.available, user.id);
  return { item: { id: item.id, available: item.available } };
});
