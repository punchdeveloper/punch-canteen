"use client";
/**
 * Section sidebar used by the Operator and Admin portals (v63
 * enhancePortalDashboard). One pane is visible at a time; the chosen section
 * is remembered for the visit (sessionStorage, same keys as v63). On phones
 * the sidebar folds behind a "☰ … sections" button.
 *
 * v63 built this by moving DOM nodes around after rendering, which is why
 * some panels leaked into every section (review N8). Here each pane is its
 * own React subtree.
 */
import { useEffect, useState, type ReactNode } from "react";

export type PortalTab = { id: string; label: string; content: ReactNode };
export type PortalLink = { label: ReactNode; onClick: () => void };

export function PortalTabs({
  title,
  toggleLabel,
  storageKey,
  tabs,
  links = [],
}: {
  title: string;
  toggleLabel: string;
  storageKey: string;
  tabs: PortalTab[];
  links?: PortalLink[];
}) {
  const [active, setActive] = useState(tabs[0]!.id);
  const [open, setOpen] = useState(false);

  // Restore the remembered section after mount (sessionStorage is browser-only).
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved && tabs.some((t) => t.id === saved)) {
      const t = setTimeout(() => setActive(saved), 0);
      return () => clearTimeout(t);
    }
  }, [storageKey, tabs]);

  function choose(id: string) {
    setActive(id);
    setOpen(false);
    sessionStorage.setItem(storageKey, id);
  }

  return (
    <>
      <button className="btn secondary portal-mobile-toggle" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ☰ {toggleLabel}
      </button>
      <div className={`portal-shell ${open ? "portal-nav-open" : ""}`}>
        <aside className="portal-side" aria-label={`${title} sections`}>
          <div className="portal-side-title">{title}</div>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={t.id === active ? "active" : ""} aria-current={t.id === active ? "true" : undefined} onClick={() => choose(t.id)}>
              {t.label}
            </button>
          ))}
          {links.map((l, i) => (
            <button key={i} type="button" onClick={l.onClick}>
              {l.label}
            </button>
          ))}
        </aside>
        <div className="portal-main">
          {tabs.map((t) => (
            <section key={t.id} className="portal-pane" hidden={t.id !== active}>
              {t.content}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
