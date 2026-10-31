"use client";
/**
 * My orders / Track order (v63 "tracking" view).
 *
 * Staff: every order with its two-step progress (Received → Ready) and the
 * digital ticket. Refreshes every 5 s, so the status changes by itself when
 * the canteen marks it ready (review N3). Collected orders show the ticket as
 * USED, so it can't be shown at the counter twice (N5).
 * Guests: look up an order by payment reference.
 */
import Link from "next/link";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { PageHead } from "@/components/page-head";
import { GuestLookup } from "@/components/views/guest-lookup";
import { fetcher } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import type { MyOrder } from "@/server/loaders";

const STATUS_LABEL: Record<MyOrder["status"], string> = {
  received: "Received",
  ready: "Ready",
  collected: "Collected",
  cancelled: "Cancelled",
};

export function StaffOrdersView({ initialOrders, staffName }: { initialOrders: MyOrder[] | null; staffName: string }) {
  const { data } = useSWR<{ orders: MyOrder[] }>(initialOrders ? "/api/orders" : null, fetcher, {
    fallbackData: initialOrders ? { orders: initialOrders } : undefined,
    refreshInterval: 5000,
  });
  const orders = data?.orders ?? [];

  return (
    <>
      <PageHead title="Your pickup orders" sub="Live orders and digital tickets from PUNCH Canteen." />
      {orders.length ? (
        orders.map((o) => {
          const pos = o.status === "received" ? 0 : 1;
          const used = o.status === "collected";
          const title =
            o.status === "collected"
              ? "Collected — enjoy your meal"
              : o.status === "ready"
                ? "Your meal is ready for pickup"
                : o.status === "cancelled"
                  ? "Order cancelled"
                  : "Order received";
          return (
            <article className="panel" key={o.id}>
              <div className="panel-head">
                <div>
                  <span className="eyebrow">ORDER {o.id}</span>
                  <h2>{title}</h2>
                </div>
                <span className="tag">{STATUS_LABEL[o.status]}</span>
              </div>
              {o.status !== "cancelled" ? (
                <ol className="tracking">
                  {["Received", "Ready"].map((st, i) => (
                    <li key={st} className={i <= pos ? "complete" : ""} aria-current={i === pos ? "step" : undefined}>
                      <span>{i + 1}</span>
                      {st}
                    </li>
                  ))}
                </ol>
              ) : null}
              <p>{o.items.map((m) => `${m.quantity} × ${m.name}`).join(" · ")}</p>
              <div className="row">
                <p>
                  {staffName}
                  <br />
                  Pickup: canteen counter
                </p>
                <strong>{formatMoney(o.totalKobo)}</strong>
              </div>
              <div className={`digital-ticket ${used ? "used" : ""}`}>
                <div className="ticket-top">
                  <div>
                    <span>DIGITAL FOOD TICKET</span>
                    <strong>{o.ticketNumber}</strong>
                  </div>
                  <b>{used ? "USED" : o.status === "cancelled" ? "VOID" : "VALID"}</b>
                </div>
                <div className="ticket-grid">
                  <span>
                    Weekly Ticket<strong>{formatMoney(o.weeklyTicketKobo)}</strong>
                  </span>
                  <span>
                    Personal Wallet<strong>{formatMoney(o.walletKobo)}</strong>
                  </span>
                  <span>
                    Order value<strong>{formatMoney(o.totalKobo)}</strong>
                  </span>
                </div>
                <div className="qr-demo">
                  <div aria-hidden="true">▦</div>
                  <span>
                    {used ? "Collected at the canteen counter" : "Show this ticket at the canteen counter"}
                    <br />
                    <b>{o.ticketNumber}</b>
                  </span>
                </div>
              </div>
            </article>
          );
        })
      ) : (
        <div className="panel empty">
          <h2>No orders yet</h2>
          <p>Your next lunch starts here.</p>
          <Link className="btn" href="/menu">
            Browse menu
          </Link>
        </div>
      )}
    </>
  );
}

export function GuestOrdersView({ reference }: { reference: string | null }) {
  // Fall back to the last reference this browser used (v63 kept it in localStorage).
  const [initial, setInitial] = useState<string | null>(reference);
  useEffect(() => {
    if (reference) return;
    try {
      const saved = localStorage.getItem("punch-last-guest-ref");
      if (saved) setTimeout(() => setInitial(saved), 0);
    } catch {
      /* ignore */
    }
  }, [reference]);

  return (
    <>
      <PageHead title="Track guest order" sub="Check payment confirmation and follow your meal from receipt to collection." />
      <div className="panel" style={{ maxWidth: 760 }}>
        <h2>Check Guest Order</h2>
        <p className="muted">Enter the payment reference generated at checkout. Your order remains available here after payment is confirmed.</p>
        <GuestLookup key={initial ?? ""} initialReference={initial ?? ""} buttonLabel="Check order status" autoCheck={!!reference} />
      </div>
    </>
  );
}
