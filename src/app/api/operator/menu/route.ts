/**
 * GET  /api/operator/menu — every menu item (available or not) + Today's Special.
 * POST /api/operator/menu (multipart) — add a menu item, with optional photo.
 */
import { route } from "@/lib/api";
import { readMenuForm } from "@/lib/menu-form";
import { createMenuItem } from "@/server/menu";
import { loadMenuManager } from "@/server/loaders";

export const GET = route({ auth: "operator" }, async () => ({ manager: await loadMenuManager() }));

export const POST = route({ auth: "operator" }, async ({ user, req }) => {
  const { input, photo } = await readMenuForm(await req.formData());
  const item = await createMenuItem(input, photo, user.id);
  return { item: { id: item.id, name: item.name } };
});
