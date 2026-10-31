/**
 * Staff directory management (Admin portal → Staff Management).
 *
 * Rules:
 *  * Only emails in the directory can sign in (pre-approval, as in v63).
 *  * The master administrator (users.is_master) can never be demoted,
 *    suspended, deactivated or removed — v63 only blocked this in the browser
 *    and the protecting database triggers were never installed.
 *  * Admins can't suspend, deactivate, remove or demote themselves (lock-out).
 *  * Suspending, deactivating or removing someone signs them out everywhere
 *    at once; their orders and transactions are kept.
 *  * "Remove" is a soft delete (removedAt). Adding the same email again later
 *    restores the person with their history.
 */
import "server-only";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { destroyAllSessionsFor } from "@/lib/auth/session";
import type { AccountStatus, Role } from "@/generated/prisma/enums";

/** Directory rows shown to admins (removed people are hidden). */
export function listDirectory() {
  return db.user.findMany({
    where: { removedAt: null },
    orderBy: { fullName: "asc" },
    select: {
      id: true, fullName: true, email: true, role: true, status: true, isMaster: true,
      weeklyTicketKobo: true, walletKobo: true, createdAt: true,
    },
  });
}

export async function addStaff(input: { fullName: string; email: string; role: Role }, actorId: string) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing && !existing.removedAt) throw new AppError("That email is already in the staff directory.", 409, "duplicate");

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { fullName: input.fullName, role: input.role, removedAt: null, status: existing.activatedAt ? "active" : "invited" },
      })
    : await db.user.create({ data: { ...input, createdById: actorId } });

  await audit({
    actorId, action: existing ? "staff.restore" : "staff.add", entityType: "user", entityId: user.id,
    message: `${existing ? "Restored" : "Added"} ${user.fullName} (${user.email}) as ${user.role}`,
  });
  return user;
}

/**
 * Bulk import from CSV rows (full_name,email). Everyone is added as Staff.
 * Emails already in the directory are skipped; removed people are not
 * silently restored (use "Add one employee" for that).
 */
export async function importStaff(rows: { fullName: string; email: string }[], actorId: string) {
  const unique = new Map<string, string>();
  for (const r of rows) if (!unique.has(r.email)) unique.set(r.email, r.fullName);
  if (!unique.size) throw new AppError("No valid staff rows found.");
  const result = await db.user.createMany({
    data: [...unique].map(([email, fullName]) => ({ email, fullName, role: "staff" as const, createdById: actorId })),
    skipDuplicates: true,
  });
  await audit({
    actorId, action: "staff.import", entityType: "user",
    message: `Imported ${result.count} of ${unique.size} people from CSV`,
    meta: { submitted: unique.size, added: result.count },
  });
  return { added: result.count, skipped: unique.size - result.count };
}

async function loadTarget(id: string) {
  const u = await db.user.findUnique({ where: { id } });
  if (!u || u.removedAt) throw notFound("Staff account");
  return u;
}

export async function changeRole(id: string, role: Role, actorId: string) {
  const u = await loadTarget(id);
  if (u.isMaster && role !== "admin") throw new AppError("The master administrator cannot be demoted.");
  if (u.id === actorId && role !== "admin") throw new AppError("You cannot remove your own Admin role.");
  if (u.role === role) return u;
  const updated = await db.user.update({ where: { id }, data: { role } });
  await audit({
    actorId, action: "staff.role", entityType: "user", entityId: id,
    message: `${u.fullName}: role ${u.role} → ${role}`, meta: { from: u.role, to: role },
  });
  return updated;
}

export async function changeStatus(id: string, next: Exclude<AccountStatus, "invited">, actorId: string) {
  const u = await loadTarget(id);
  if (next !== "active") {
    if (u.isMaster) throw new AppError("The master administrator cannot be suspended or deactivated.");
    if (u.id === actorId) throw new AppError("You cannot suspend or deactivate your own account.");
  }
  // Reactivating someone who never signed in puts them back to "invited".
  const status: AccountStatus = next === "active" && !u.activatedAt ? "invited" : next;
  const updated = await db.user.update({ where: { id }, data: { status } });
  if (status === "suspended" || status === "deactivated") await destroyAllSessionsFor(id);
  await audit({
    actorId, action: "staff.status", entityType: "user", entityId: id,
    message: `${u.fullName}: ${u.status} → ${status}`, meta: { from: u.status, to: status },
  });
  return updated;
}

export async function removeStaff(id: string, actorId: string) {
  const u = await loadTarget(id);
  if (u.isMaster) throw new AppError("The master administrator cannot be removed.");
  if (u.id === actorId) throw new AppError("You cannot remove your own account.");
  await db.user.update({ where: { id }, data: { removedAt: new Date(), status: "deactivated" } });
  await destroyAllSessionsFor(id);
  await audit({
    actorId, action: "staff.remove", entityType: "user", entityId: id,
    message: `Removed ${u.fullName} (${u.email}) from the staff directory`,
  });
}

/** Parse one CSV line, honouring quotes ("a, b" and "" escapes). Same as v63. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Read a full_name,email CSV into rows. Throws a friendly error when the columns are missing. */
export function parseStaffCsv(text: string): { fullName: string; email: string }[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new AppError("CSV has no staff rows.");
  const headers = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const ni = headers.indexOf("full_name");
  const ei = headers.indexOf("email");
  if (ni < 0 || ei < 0) throw new AppError("CSV must contain full_name and email columns.");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return lines
    .slice(1)
    .map((l) => parseCsvLine(l))
    .map((c) => ({ fullName: String(c[ni] ?? "").trim(), email: String(c[ei] ?? "").trim().toLowerCase() }))
    .filter((r) => r.fullName && emailOk.test(r.email));
}
