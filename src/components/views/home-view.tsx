"use client";
/**
 * Home (v63 "v52" home): greeting with live Lagos date/time, Today's
 * Special, and the three shortcut tiles.
 * Fix: the 👋 now stays on the same line as the first name on phones.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { formatMoney } from "@/lib/money";

function useLagosClock() {
  // Empty until mounted, so the server-rendered HTML and the first client render match.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  if (!now) return { date: "", time: "", hour: null as number | null };
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const time =
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })
      .format(now)
      .replace(/ am$/i, " AM")
      .replace(/ pm$/i, " PM") + " WAT";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", hourCycle: "h23" }).format(now));
  return { date, time, hour };
}

export function HomeView() {
  const { me, menu, addToCart } = useApp();
  const clock = useLagosClock();
  const firstName = me ? me.user.fullName.trim().split(/\s+/)[0] : "";
  const greeting = clock.hour === null ? "Hello" : clock.hour < 12 ? "Good morning" : clock.hour < 17 ? "Good afternoon" : "Good evening";
  const special = menu.todaysSpecialId ? menu.items.find((m) => m.id === menu.todaysSpecialId) : undefined;
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div className="v52-home">
      <section className="v52-welcome">
        <h1>
          {me ? (
            <>
              {greeting}, <span className="nowrap">{firstName} 👋</span>
            </>
          ) : (
            "Welcome to the PUNCH Canteen"
          )}
        </h1>
        <div className="v52-live-datetime">
          <span>{clock.date}</span>
          <span aria-hidden="true">•</span>
          <span className="v52-live-time">{clock.time}</span>
        </div>
      </section>

      <section>
        <h2 className="v52-section-title">TODAY’S SPECIAL</h2>
        {special ? (
          <article className="v52-special">
            <div className="v52-special-photo">
              {special.imageUrl && !photoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element -- photo served by our own /media route
                <img src={special.imageUrl} alt={special.name} loading="eager" decoding="async" onError={() => setPhotoFailed(true)} />
              ) : null}
              <div className="v52-photo-fallback" style={special.imageUrl && !photoFailed ? undefined : { display: "grid" }}>
                PUNCH Canteen · Today’s Special
              </div>
            </div>
            <div className="v52-special-copy">
              <h2>{special.name}</h2>
              <strong className="v52-price">{formatMoney(special.priceKobo)}</strong>
              <p>{special.description || "Freshly prepared for PUNCH staff."}</p>
              <button className="v52-order" type="button" onClick={() => addToCart(special.id)}>
                Order now &nbsp; →
              </button>
            </div>
          </article>
        ) : (
          <article className="v52-special">
            <div className="v52-special-copy">
              <h2>Today’s special will be announced shortly.</h2>
              <p>Check back soon for today’s featured meal.</p>
            </div>
          </article>
        )}
      </section>

      <section className="v52-family">
        <h2 className="v52-section-title">MADE FOR THE PUNCH FAMILY</h2>
        <p className="v52-family-copy">Good food. Simple ordering. Less waiting.</p>
        <div className="v52-actions">
          <Link className="v52-action" href="/menu">
            <span className="v52-action-icon">🍴</span>
            <strong>
              Choose
              <br />
              your meal
            </strong>
          </Link>
          <Link className="v52-action" href="/orders">
            <span className="v52-action-icon">📋</span>
            <strong>
              Track
              <br />
              your order
            </strong>
          </Link>
          <Link className="v52-action" href="/reviews">
            <span className="v52-action-icon">★</span>
            <strong>
              Share
              <br />
              feedback
            </strong>
          </Link>
        </div>
      </section>
    </div>
  );
}
