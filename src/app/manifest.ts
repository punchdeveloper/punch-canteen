/**
 * Web app manifest (served at /manifest.webmanifest), so staff can install
 * PUNCH Canteen on their phones. v63 linked a manifest that returned 404.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PUNCH Canteen",
    short_name: "PUNCH Canteen",
    description: "Order lunch, show your digital food ticket and manage your canteen wallet.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#ed1c24",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
