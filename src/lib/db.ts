/**
 * Database client.
 *
 * Prisma 7 talks to Postgres through a driver adapter (`pg`). We keep one
 * client per server process; in development Next.js reloads modules on every
 * change, so the client is cached on `globalThis` to avoid opening a new
 * connection pool each time.
 */
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** The transaction client type, for service functions that run inside `db.$transaction`. */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
