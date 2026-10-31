"use client";
/** Today's menu with All / Meals / Drinks filter (v63 "menu" view). */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { PageHead } from "@/components/page-head";
import { formatMoney } from "@/lib/money";

const CATEGORIES = ["All", "Meals", "Drinks"] as const;

export function MenuView() {
  const { menu, addToCart } = useApp();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const items = menu.items.filter((m) => category === "All" || m.category === category);

  return (
    <>
      <PageHead title="Today’s menu" sub="Choose your lunch. Browse today’s available meals and drinks." />
      <div className="filters" aria-label="Meal categories">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={`btn ${category === c ? "" : "secondary"}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      {items.length ? (
        <div className="menu-grid">
          {items.map((m) => {
            const drink = m.category === "Drinks";
            return (
              <article key={m.id} className="meal food-card">
                <div className="meal-photo">
                  {m.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photo served by our own /media route
                    <img src={m.imageUrl} alt={`${m.name} — illustrative meal photograph`} loading="lazy" />
                  ) : null}
                  <span className="meal-badge">{drink ? "DRINK" : "FRESHLY PREPARED"}</span>
                </div>
                <div className="meal-body">
                  <div className="panel-head">
                    <span className="eyebrow">{drink ? "DRINKS" : "TODAY’S MENU"}</span>
                    <span className="tag">Available</span>
                  </div>
                  <h2>{m.name}</h2>
                  <p>{m.description ?? ""}</p>
                  <p className="allergen">Allergen note: {m.allergens || "Ask staff about ingredients"}</p>
                  <div className="row">
                    <strong className="price">{formatMoney(m.priceKobo)}</strong>
                    <button className="btn" type="button" onClick={() => addToCart(m.id)}>
                      Add to cart
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel empty">
          <h2>Nothing here right now</h2>
          <p>{category === "All" ? "The menu will appear here once the canteen adds today’s meals." : `No ${category.toLowerCase()} are available at the moment.`}</p>
        </div>
      )}
    </>
  );
}
