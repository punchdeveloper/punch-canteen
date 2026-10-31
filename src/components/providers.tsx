"use client";
/**
 * App-wide client state.
 *
 *  * me     — signed-in person, live balances and unread chat counts.
 *             Server-rendered first, then refreshed every 5 s (v63 polled
 *             unread counts every 5 s too).
 *  * menu   — available menu + Today's Special (refreshed every 60 s).
 *  * cart   — { menuItemId: quantity }, kept in localStorage like v63
 *             ("punch-cart"), so it survives refreshes.
 *  * guest  — "continue as guest" mode, kept in a cookie so the server can
 *             render guest pages directly.
 *  * toast  — the little message at the bottom of the screen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useSWR, { SWRConfig } from "swr";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/client/api";
import type { MeData, MenuData } from "@/server/loaders";

type Cart = Record<string, number>;

type AppState = {
  me: MeData | null;
  refreshMe: () => Promise<unknown>;
  menu: MenuData;
  refreshMenu: () => Promise<unknown>;
  cart: Cart;
  cartCount: number;
  cartTotalKobo: number;
  addToCart: (menuItemId: number) => void;
  removeFromCart: (menuItemId: number) => void;
  clearCart: () => void;
  guest: boolean;
  setGuest: (on: boolean) => void;
  toast: (message: string) => void;
  toastMessage: string | null;
};

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProviders>");
  return v;
}

const CART_KEY = "punch-cart";

export function AppProviders({
  children,
  initialMe,
  initialMenu,
  initialGuest,
}: {
  children: ReactNode;
  initialMe: MeData | null;
  initialMenu: MenuData;
  initialGuest: boolean;
}) {
  const router = useRouter();

  // --- me -------------------------------------------------------------------
  const { data: meData, mutate: mutateMe } = useSWR<{ me: MeData | null }>("/api/me", fetcher, {
    fallbackData: { me: initialMe },
    refreshInterval: 5000,
    revalidateOnMount: false,
  });
  const me = meData?.me ?? null;

  // --- menu -----------------------------------------------------------------
  const { data: menuData, mutate: mutateMenu } = useSWR<{ menu: MenuData }>("/api/menu", fetcher, {
    fallbackData: { menu: initialMenu },
    refreshInterval: 60_000,
    revalidateOnMount: false,
  });
  const menu = menuData?.menu ?? initialMenu;

  // --- toast ----------------------------------------------------------------
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // --- cart -----------------------------------------------------------------
  // Read localStorage only after mount, so server and first client render match.
  const [cart, setCart] = useState<Cart>({});
  const loaded = useRef(false);
  useEffect(() => {
    // Deferred one tick: restoring the cart is a hydration step, not part of this render.
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
        if (saved && typeof saved === "object") setCart(saved);
      } catch {
        /* storage unavailable or corrupt: start empty */
      }
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* private mode: cart lasts for this visit only */
    }
  }, [cart]);

  // Items that disappear from the menu (made unavailable) leave the cart.
  const priced = useMemo(() => {
    const byId = new Map(menu.items.map((m) => [String(m.id), m]));
    return Object.entries(cart).filter(([id, q]) => byId.has(id) && q > 0).map(([id, q]) => ({ item: byId.get(id)!, quantity: q }));
  }, [cart, menu.items]);
  const cartCount = priced.reduce((n, l) => n + l.quantity, 0);
  const cartTotalKobo = priced.reduce((n, l) => n + l.item.priceKobo * l.quantity, 0);

  const addToCart = useCallback(
    (id: number) => {
      setCart((c) => ({ ...c, [id]: Math.min(20, (c[id] ?? 0) + 1) }));
      toast("Added to your cart");
    },
    [toast],
  );
  const removeFromCart = useCallback(
    (id: number) => {
      setCart((c) => {
        const key = String(id);
        const next: Cart = { ...c, [key]: (c[key] ?? 0) - 1 };
        if (next[key]! <= 0) delete next[key];
        return next;
      });
      toast("Cart updated");
    },
    [toast],
  );
  const clearCart = useCallback(() => setCart({}), []);

  // --- guest ----------------------------------------------------------------
  const [guest, setGuestState] = useState(initialGuest);
  const setGuest = useCallback(
    (on: boolean) => {
      document.cookie = on ? "pc_guest=1; path=/; max-age=2592000; samesite=lax" : "pc_guest=; path=/; max-age=0; samesite=lax";
      setGuestState(on);
      router.refresh();
    },
    [router],
  );

  const value: AppState = {
    me,
    refreshMe: () => mutateMe(),
    menu,
    refreshMenu: () => mutateMenu(),
    cart,
    cartCount,
    cartTotalKobo,
    addToCart,
    removeFromCart,
    clearCart,
    guest: guest && !me,
    setGuest,
    toast,
    toastMessage,
  };

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false }}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </SWRConfig>
  );
}

/** The cart as priced lines (menu item + quantity), for the cart and checkout. */
export function useCartLines() {
  const { cart, menu } = useApp();
  return useMemo(() => {
    const byId = new Map(menu.items.map((m) => [String(m.id), m]));
    return Object.entries(cart)
      .filter(([id, q]) => byId.has(id) && q > 0)
      .map(([id, quantity]) => ({ item: byId.get(id)!, quantity }));
  }, [cart, menu.items]);
}
