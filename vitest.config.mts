/**
 * Test runner config.
 * Integration tests use a separate database (punch_canteen_test, see .env.test)
 * and run one file at a time so they never trip over each other's data.
 * `server-only` and `next/headers` are stubbed: services run outside a request.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.test", override: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
      "next/headers": path.resolve(__dirname, "tests/stubs/next-headers.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
