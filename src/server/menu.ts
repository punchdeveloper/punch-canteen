/**
 * Menu management and menu photos.
 *
 * Photos are stored on disk in STORAGE_DIR/menu (a Docker volume on the
 * droplet) and served by /media/menu/<file>. v63 stored them in Supabase
 * Storage, and most of its photos were pasted into the page as base64.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { audit } from "@/lib/audit";
import type { MenuCategory } from "@/generated/prisma/enums";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function storageDir(...parts: string[]) {
  return path.resolve(process.env.STORAGE_DIR || "./storage", ...parts);
}

/** Public URL for a menu photo file name (null when the item has no photo). */
export const menuPhotoUrl = (file: string | null | undefined) => (file ? `/media/menu/${file}` : null);

/** Public menu: available items only, in menu order. */
export function listAvailableMenu() {
  return db.menuItem.findMany({ where: { available: true }, orderBy: { id: "asc" } });
}

/** Operator view: every item, available or not. */
export function listAllMenu() {
  return db.menuItem.findMany({ orderBy: { id: "asc" } });
}

/**
 * Check a photo by its first bytes (not its file name or claimed type) and
 * return the extension to save it with.
 */
export function detectImageType(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

/** Save an uploaded photo; returns the stored file name. */
export async function saveMenuPhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) throw new AppError("Food photo must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = detectImageType(buf);
  if (!ext) throw new AppError("Please choose a JPG, PNG or WebP image.");
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  await mkdir(storageDir("menu"), { recursive: true });
  await writeFile(storageDir("menu", name), buf);
  return name;
}

export type MenuInput = {
  name: string;
  priceKobo: number;
  category: MenuCategory;
  description: string | null;
  allergens: string | null;
};

export async function createMenuItem(input: MenuInput, photo: File | null, actorId: string) {
  const imageFile = photo ? await saveMenuPhoto(photo) : null;
  const item = await db.menuItem.create({ data: { ...input, imageFile, available: true } });
  await audit({
    actorId, action: "menu.create", entityType: "menu_item", entityId: item.id,
    message: `Added ${item.name} at ${formatMoney(item.priceKobo)}`,
  });
  return item;
}

export async function updateMenuItem(id: number, input: MenuInput, photo: File | null, actorId: string) {
  const before = await db.menuItem.findUnique({ where: { id } });
  if (!before) throw notFound("Menu item");
  const imageFile = photo ? await saveMenuPhoto(photo) : before.imageFile;
  const item = await db.menuItem.update({ where: { id }, data: { ...input, imageFile } });
  // Remove the replaced photo file (ignore if it was already gone).
  if (photo && before.imageFile) unlink(storageDir("menu", before.imageFile)).catch(() => {});
  await audit({
    actorId, action: "menu.update", entityType: "menu_item", entityId: id,
    message: `Updated ${item.name}`,
    meta: {
      before: { name: before.name, priceKobo: before.priceKobo, category: before.category },
      after: { name: item.name, priceKobo: item.priceKobo, category: item.category },
      photoReplaced: !!photo,
    },
  });
  return item;
}

export async function setMenuAvailability(id: number, available: boolean, actorId: string) {
  const item = await db.menuItem.update({ where: { id }, data: { available } }).catch(() => {
    throw notFound("Menu item");
  });
  await audit({
    actorId, action: available ? "menu.available" : "menu.unavailable", entityType: "menu_item", entityId: id,
    message: `${item.name} marked ${available ? "available" : "unavailable"}`,
  });
  return item;
}

// ---------------------------------------------------------------------------
// Settings: Today's Special and the canteen bank account
// ---------------------------------------------------------------------------

/** The single settings row, created with defaults the first time it's read. */
export async function getSettings() {
  return db.canteenSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export async function setTodaysSpecial(menuItemId: number, actorId: string) {
  const item = await db.menuItem.findUnique({ where: { id: menuItemId } });
  if (!item || !item.available || item.category !== "Meals") {
    throw new AppError("Choose an available meal for Today's Special.");
  }
  await db.canteenSettings.upsert({
    where: { id: 1 },
    create: { id: 1, todaysSpecialItemId: menuItemId, updatedById: actorId },
    update: { todaysSpecialItemId: menuItemId, updatedById: actorId },
  });
  await audit({
    actorId, action: "settings.todays_special", entityType: "canteen_settings", entityId: 1,
    message: `Today's Special set to ${item.name}`,
  });
  return item;
}
