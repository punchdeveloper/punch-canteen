/**
 * Seed the database with the real canteen setup taken from the live v63
 * site on 31 Oct 2026: the 9 menu items (with photos), the 15-person staff
 * directory, Today's Special and the canteen bank account.
 *
 * NOT seeded: orders, top-ups, reviews, chat — the live data was all test
 * data. Balances start at zero.
 *
 * Safe to run more than once: items and people are matched by name/email
 * and updated, never duplicated. Run with `npx prisma db seed`.
 */
import "dotenv/config";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const kobo = (naira: number) => Math.round(naira * 100);

/** Live menu (ids 1–9). Plantain's ₦50 price is as found on the live site. */
const MENU = [
  { name: "Jollof rice & grilled chicken", price: 2500, category: "Meals", photo: "01-jollof-rice.jpg" },
  { name: "Ofada rice and egg", price: 2500, category: "Meals", photo: "02-ofada-rice-egg.jpeg" },
  { name: "Ofada rice & stew", price: 2000, category: "Meals", photo: "03-ofada-rice-stew.jpg" },
  { name: "Amala & ewedu", price: 1500, category: "Meals", photo: "04-amala-ewedu.jpg" },
  { name: "Eba & egusi", price: 1500, category: "Meals", photo: "05-eba-egusi.jpg" },
  { name: "Grilled fish", price: 2500, category: "Meals", photo: "06-grilled-fish.jpg" },
  { name: "Beans porridge", price: 1500, category: "Meals", photo: "07-beans-porridge.jpg" },
  { name: "Zobo drink", price: 800, category: "Drinks", photo: "08-zobo-drink.jpg" },
  { name: "Plantain", price: 50, category: "Meals", photo: "09-plantain.jpg", allergens: "Not specified" },
] as const;

/** Live staff directory. Status "active" = has signed in before. */
const STAFF = [
  ["Samson Folarin", "sfolarin@punchng.com", "admin", "active", true],
  ["Emmanuel Gideon-Dada", "egideon-dada@punchng.com", "admin", "active", false],
  ["Joseph Adeyeye", "sfolarinuk@gmail.com", "staff", "active", false],
  ["Kemi Ogungbemi", "logungbemi@punchng.com", "staff", "invited", false],
  ["Olalekan Akowonjo", "oakowonjo@punchng.com", "staff", "active", false],
  ["Adegbemiga Okunlade", "aokunlade@punchng.com", "staff", "active", false],
  ["Oyetunji Abioye", "oabioye@punchng.com", "staff", "invited", false],
  ["Olayinka Popoola", "opopoola@punchng.com", "staff", "active", false],
  ["Omolara Ogunleye", "oogunleye@punchng.com", "staff", "active", false],
  ["Olalekan Adetayo", "oadetayo@punchng.com", "staff", "invited", false],
  ["Rebecca Erureh", "rerureh@punchng.com", "staff", "active", false],
  ["Dele Aina", "oaina@punchfoundation.org", "staff", "invited", false],
  ["Joseph Adeyeye", "ajoseph@punchng.com", "staff", "invited", false],
  ["Wunmi Tunde-Obe", "otunde-obe@punchng.com", "staff", "invited", false],
  ["Temitope Olusesan-Biala", "tolusesan-biala@punchng.com", "staff", "active", false],
] as const;

async function main() {
  // Menu photos go into the runtime photo store (STORAGE_DIR/menu).
  const storeDir = path.resolve(process.env.STORAGE_DIR || "./storage", "menu");
  await mkdir(storeDir, { recursive: true });

  for (const m of MENU) {
    await copyFile(path.join(__dirname, "seed-assets", "menu", m.photo), path.join(storeDir, m.photo));
    const data = {
      name: m.name,
      priceKobo: kobo(m.price),
      category: m.category,
      imageFile: m.photo,
      allergens: "allergens" in m ? m.allergens : null,
      available: true,
    };
    const existing = await db.menuItem.findFirst({ where: { name: m.name } });
    if (existing) await db.menuItem.update({ where: { id: existing.id }, data });
    else await db.menuItem.create({ data });
  }

  for (const [fullName, email, role, status, isMaster] of STAFF) {
    const activatedAt = status === "active" ? new Date("2026-10-26T00:00:00Z") : null;
    await db.user.upsert({
      where: { email },
      create: { fullName, email, role, status, isMaster, activatedAt },
      update: { fullName, role, isMaster },
    });
  }

  // Today's Special on the live site was Grilled fish.
  const special = await db.menuItem.findFirst({ where: { name: "Grilled fish" } });
  await db.canteenSettings.upsert({
    where: { id: 1 },
    create: { id: 1, todaysSpecialItemId: special?.id ?? null },
    update: { todaysSpecialItemId: special?.id ?? null },
  });

  const counts = { menu: await db.menuItem.count(), users: await db.user.count() };
  console.log(`Seeded: ${counts.menu} menu items, ${counts.users} people, Today's Special = ${special?.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
