/**
 * Next.js configuration.
 *
 * Cache Components / partial prefetching (on in the Next 16 starter) are off:
 * every page here depends on who is signed in and on live balances/queues,
 * so pages are rendered per request (reading cookies makes them dynamic).
 *
 * `output: "standalone"` produces a small self-contained server for the
 * DigitalOcean droplet (see docs/DEPLOYMENT.md).
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
};

export default nextConfig;
