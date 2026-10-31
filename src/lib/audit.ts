/**
 * Audit log (convention #6): every operator/admin change is recorded with
 * who did it, what, to which record, and from where.
 * Pass the transaction client when the change happens inside a transaction,
 * so the log entry commits (or rolls back) together with the change.
 */
import "server-only";
import { headers } from "next/headers";
import { db, type Tx } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";

export type AuditEntry = {
  actorId: string | null;
  action: string; // e.g. "order.ready", "topup.confirm", "staff.role"
  entityType: string; // e.g. "order", "wallet_topup", "user"
  entityId?: string | number | null;
  message: string;
  meta?: Prisma.InputJsonValue;
};

export async function audit(entry: AuditEntry, tx: Tx | typeof db = db) {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip = clientIp(h);
    userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    // Called outside a request (scripts, cron job): no request metadata.
  }
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId == null ? null : String(entry.entityId),
      message: entry.message,
      meta: entry.meta,
      ip,
      userAgent,
    },
  });
}
