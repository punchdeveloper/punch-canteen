/**
 * Root layout: fonts, metadata, <body> classes and the app shell.
 *
 * Everything the shell needs on first paint is loaded here on the server
 * (who is signed in, the menu, guest mode), so the page never starts blank.
 */
import type { Metadata, Viewport } from "next";
import { Comic_Neue, DM_Sans, Lora } from "next/font/google";
import { cookies, headers } from "next/headers";
import { AppProviders } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import { bodyClassFor } from "@/lib/areas";
import { loadMe, loadMenu } from "@/server/loaders";
import "./styles/v63.css";
import "./styles/fixes.css";

// v63's fonts: Comic Neue for almost all text, DM Sans as the base, Lora for quotes.
const comic = Comic_Neue({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-comic", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const lora = Lora({ weight: "600", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-lora", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PUNCH Canteen", template: "%s · PUNCH Canteen" },
  description: "PUNCH Canteen — menu, digital food tickets, Weekly Ticket and Personal Wallet for PUNCH staff.",
  applicationName: "PUNCH Canteen",
  // Internal staff tool: keep it out of search engines.
  robots: { index: false, follow: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#ed1c24",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, menu, h, jar] = await Promise.all([getSessionUser(), loadMenu(), headers(), cookies()]);
  const me = user ? await loadMe(user) : null;
  const path = h.get("x-pc-path") ?? "/";
  const guest = !user && jar.get("pc_guest")?.value === "1";

  return (
    <html lang="en" className={`${comic.variable} ${dmSans.variable} ${lora.variable}`}>
      <body className={bodyClassFor(path)}>
        <noscript>
          <div style={{ padding: 16, background: "#fff3cd", color: "#664d03" }}>JavaScript is required to use PUNCH Canteen.</div>
        </noscript>
        <AppProviders initialMe={me} initialMenu={menu} initialGuest={guest}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
