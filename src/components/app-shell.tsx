"use client";
/**
 * The page frame around every screen, rebuilt from v63's render():
 *
 *   <aside>   logo, sidebar navigation, role button ("Management" etc.)
 *   <main>    <header> breadcrumb + actions, the page, <footer>, cart bar
 *   #toast, #mobile-bottom-nav (staff side, ≤1024px), install banner
 *
 * Same element structure and class names as v63, so the carried-over CSS
 * applies unchanged. Differences: navigation uses real links, the body
 * classes follow the URL, and the labels in the Operator portal say Operator.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/components/providers";
import { bottomIcons, sideIcons } from "@/components/icons";
import { InstallBanner } from "@/components/install-banner";
import { apiSend } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import { areaOf, bodyClassFor, crumbFor, navLabel, workspaceLabel } from "@/lib/areas";

type NavItem = { href: string; key: string; label: string; badge?: number };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, refreshMe, guest, cartCount, cartTotalKobo, toast, toastMessage } = useApp();
  const area = areaOf(pathname);
  const staffSide = area === "staff";
  const signedIn = !!me;
  const unreadStaff = me?.staffUnreadCount ?? 0;
  const unreadOperator = me?.operatorUnreadCount ?? 0;

  // Keep <body> classes in step with client-side navigation.
  useEffect(() => {
    document.body.className = bodyClassFor(pathname);
  }, [pathname]);

  const nav: NavItem[] =
    area === "operator"
      ? [
          { href: "/operator", key: "operator", label: "Live orders & menu" },
          { href: "/operator/chat", key: "operator-chat", label: "Canteen Chat", badge: unreadOperator },
        ]
      : area === "admin"
        ? [{ href: "/admin", key: "canteen-admin", label: "Reviews & data" }]
        : area === "portal"
          ? [{ href: "/portals", key: "admin", label: "Admin portals" }]
          : signedIn
            ? [
                { href: "/", key: "home", label: "Home" },
                { href: "/menu", key: "menu", label: "Menu" },
                { href: "/cart", key: "cart", label: "Cart" },
                { href: "/orders", key: "tracking", label: "My orders" },
                { href: "/chat", key: "chat", label: "Chat", badge: unreadStaff },
                { href: "/account", key: "account", label: "My Account" },
                { href: "/reviews", key: "review", label: "Reviews" },
              ]
            : [
                { href: "/", key: "home", label: "Home" },
                { href: "/menu", key: "menu", label: "Menu" },
                { href: "/cart", key: "cart", label: "Cart" },
                { href: "/orders", key: "tracking", label: "Track order" },
                { href: "/chat", key: "chat", label: "Chat" },
                { href: "/reviews", key: "review", label: "Reviews" },
              ];

  const isActive = (href: string) => pathname === href;

  async function signOut() {
    try {
      await apiSend("/api/auth/sign-out", "POST");
    } finally {
      await refreshMe();
      router.push("/");
      router.refresh();
      toast("Signed out");
    }
  }

  const initials = signedIn
    ? me.user.fullName.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase()
    : "";
  const role = me?.user.role;

  return (
    <>
      <aside>
        <Link className="brand punch-brand-logo" href="/" aria-label="PUNCH Canteen home">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark, styled by v63 CSS */}
          <img src="/brand/punch-logo.png" alt="PUNCH" width={142} height={62} />
          <span className="canteen-word">CANTEEN</span>
        </Link>
        <p className="nav-label">{navLabel(area)}</p>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              data-go={n.key}
              className={isActive(n.href) ? "active" : ""}
              aria-current={isActive(n.href) ? "page" : undefined}
            >
              <span className="nav-icon">{sideIcons[n.key] ?? null}</span>
              <span>
                {n.label}
                {n.badge ? <UnreadBadge count={n.badge} /> : null}
              </span>
            </Link>
          ))}
        </nav>
        <div className="aside-note">
          {!staffSide ? (
            <>
              <Link className="btn secondary full" href="/">
                Staff ordering
              </Link>
              <p>Access is restricted to authorised accounts.</p>
            </>
          ) : role === "admin" ? (
            <Link className="btn secondary full" href="/admin">
              Management
            </Link>
          ) : role === "operator" ? (
            <Link className="btn secondary full" href="/operator">
              Operator Portal
            </Link>
          ) : null}
        </div>
      </aside>

      <main>
        <header>
          <span>
            {workspaceLabel(area)} <i>/</i> <span id="crumb">{crumbFor(pathname)}</span>
          </span>
          <div className="header-actions">
            {!staffSide ? (
              <Link className="btn secondary" href="/">
                Staff area
              </Link>
            ) : (
              <>
                {signedIn ? (
                  <>
                    <Link className="staff-chip" href="/account">
                      <span className="mini-avatar">{initials}</span>
                      {me.user.fullName}
                    </Link>
                    <button className="btn secondary" type="button" onClick={signOut}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="btn secondary" href="/portals">
                      Admin
                    </Link>
                    <Link className="btn" href="/login">
                      Staff login
                    </Link>
                  </>
                )}
                <Link className="btn secondary" href="/cart">
                  Cart · {cartCount}
                </Link>
              </>
            )}
          </div>
        </header>

        <section id="content">{children}</section>

        <footer>
          PUNCH CANTEEN <span>Made for your everyday lunch break.</span>
        </footer>

        {staffSide && (pathname === "/" || pathname === "/menu") && cartTotalKobo > 0 ? (
          <div className="cart-bar">
            <Link className="btn" href="/cart">
              View cart · {cartCount} items <span>{formatMoney(cartTotalKobo)} →</span>
            </Link>
          </div>
        ) : null}
      </main>

      <div id="toast" role="status" aria-live="polite" className={toastMessage ? "show" : ""}>
        {toastMessage}
      </div>

      {staffSide ? <BottomNav pathname={pathname} cartCount={cartCount} unread={signedIn ? unreadStaff : 0} guest={guest} /> : null}

      <InstallBanner />
    </>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <>
      {" "}
      <span className="chat-unread-badge" aria-label={`${count} unread messages`}>
        {count > 99 ? "99+" : count}
      </span>
    </>
  );
}

/** Phone/tablet tab bar (shown by CSS at ≤1024px on the staff side only). */
function BottomNav({ pathname, cartCount, unread }: { pathname: string; cartCount: number; unread: number; guest: boolean }) {
  const items = [
    ["/", "home", "Home"],
    ["/menu", "menu", "Menu"],
    ["/cart", "cart", "Cart"],
    ["/orders", "tracking", "Orders"],
    ["/chat", "chat", "Chat"],
    ["/account", "account", "Account"],
    ["/reviews", "review", "Reviews"],
  ] as const;
  return (
    <nav id="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map(([href, key, label]) => {
        const active = pathname === href;
        return (
          <Link key={key} href={href} data-go={key} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            {key === "cart" && cartCount > 0 ? (
              <span className="cart-count" aria-label={`${cartCount} items in cart`}>
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : key === "chat" && unread > 0 ? (
              <span className="chat-unread-badge" aria-label={`${unread} unread messages`}>
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
            <span className="bottom-icon">{bottomIcons[key]}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
