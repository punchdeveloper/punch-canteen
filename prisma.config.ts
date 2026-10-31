/**
 * Prisma CLI configuration (Prisma 7).
 * Prisma 7 no longer reads `.env` by itself, so we load it here. The app
 * itself connects through `src/lib/db.ts` using the pg driver adapter.
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
