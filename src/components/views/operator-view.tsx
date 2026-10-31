"use client";
/**
 * Canteen Operator portal (v63 "operator" view).
 *
 * Sections: Overview, Guest Payments, Guest Kitchen Orders, Wallet Top-ups,
 * Live Orders, plus links to Manage Menu and Chat.
 *
 * Fixes from the review:
 *   N1  the data refreshes every 5 s — new orders/top-ups appear on their own
 *   N5  "Mark ready" is followed by "Mark collected", which uses the ticket up
 *   N10 rejecting a top-up (or guest payment) can include a reason
 * The Refresh button is kept for an instant update.
 */
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { PageHead, fmt } from "@/components/page-head";
import { PortalTabs } from "@/components/portal-tabs";
import { apiSend, fetcher } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import type { OperatorOverview } from "@/server/loaders";

const items = (list: { name: string; quantity: number }[]) => list.map((i) => `${i.quantity}× ${i.name}`).join(", ");

export function OperatorView({ initial }: { initial: OperatorOverview }) {
  const router = useRouter();
  const { me, toast } = useApp();
  const { data, mutate } = useSWR<{ overview: OperatorOverview }>("/api/operator/overview", fetcher, {
    fallbackData: { overview: initial },
    refreshInterval: 5000,
  });
  const o = data?.overview ?? initial;
  const [busy, setBusy] = useState<string | null>(null);
  const pendingGuests = o.guestOrders.filter((g) => g.paymentStatus === "pending");
  const kitchenGuests = o.guestOrders.filter((g) => g.paymentStatus === "confirmed");
  const unread = me?.operatorUnreadCount ?? 0;

  /** Run an action with a busy flag on one button, then refresh the data. */
  async function act(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await fn();
      await mutate();
      toast(success);
    } catch (err) {
      toast((err as Error).message);
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  function confirmTopup(t: OperatorOverview["topups"][number]) {
    if (!confirm(`Confirm that ${formatMoney(t.amountKobo)} from ${t.name} has been received in the canteen bank account?`)) return;
    act(`topup-${t.id}`, () => apiSend(`/api/operator/topups/${t.id}`, "POST", { action: "confirm" }), `Payment confirmed · ${formatMoney(t.amountKobo)}`);
  }
  function rejectTopup(t: OperatorOverview["topups"][number]) {
    const reason = prompt(
      `Reject the pending ${formatMoney(t.amountKobo)} wallet top-up request from ${t.name}? No money will be credited.\n\nReason shown to ${t.name.split(" ")[0]} (optional):`,
    );
    if (reason === null) return;
    act(
      `topup-${t.id}`,
      () => apiSend(`/api/operator/topups/${t.id}`, "POST", { action: "reject", reason }),
      `Wallet request rejected · ${formatMoney(t.amountKobo)} · no credit applied`,
    );
  }
  function confirmGuest(g: OperatorOverview["guestOrders"][number]) {
    if (!confirm(`Confirm that ${formatMoney(g.totalKobo)} from ${g.guestName} has been received? This will generate the guest's digital food ticket.`)) return;
    act(`guest-${g.id}`, () => apiSend(`/api/operator/guest-orders/${g.id}`, "POST", { action: "confirm" }), "Guest payment confirmed · ticket generated");
  }
  function rejectGuest(g: OperatorOverview["guestOrders"][number]) {
    const reason = prompt(`Reject ${g.guestName}'s ${formatMoney(g.totalKobo)} guest payment? Their order will not be prepared.\n\nReason shown to the guest (optional):`);
    if (reason === null) return;
    act(`guest-${g.id}`, () => apiSend(`/api/operator/guest-orders/${g.id}`, "POST", { action: "reject", reason }), "Guest payment rejected");
  }

  async function refresh() {
    await mutate();
    toast("Operator data refreshed");
  }

  const overviewPane = (
    <div className="analytics-grid">
      <div className="analytic">
        <span>ORDERS</span>
        <strong>{o.orders.length}</strong>
      </div>
      <div className="analytic">
        <span>RECEIVED</span>
        <strong>{o.orders.filter((x) => x.status === "received").length}</strong>
      </div>
      <div className="analytic">
        <span>READY</span>
        <strong>{o.orders.filter((x) => x.status === "ready").length}</strong>
      </div>
      <div className="analytic">
        <span>PENDING TOP-UPS</span>
        <strong>{o.topups.length}</strong>
      </div>
    </div>
  );

  const guestPaymentsPane = (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Guest Payments</h2>
          <p className="muted">Confirm only after verifying the exact transfer in the canteen bank account. A digital ticket is generated after confirmation.</p>
        </div>
      </div>
      {pendingGuests.length ? (
        <table className="ops-table">
          <thead>
            <tr>
              <th>GUEST</th>
              <th>PHONE</th>
              <th>MEALS</th>
              <th>AMOUNT</th>
              <th>REFERENCE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {pendingGuests.map((g) => (
              <tr key={g.id}>
                <td>{g.guestName}</td>
                <td>{g.phoneNumber}</td>
                <td>{items(g.items)}</td>
                <td>
                  <strong>{formatMoney(g.totalKobo)}</strong>
                </td>
                <td>{g.paymentReference}</td>
                <td>
                  <div className="actions">
                    <button className="btn" type="button" disabled={busy === `guest-${g.id}`} onClick={() => confirmGuest(g)}>
                      Confirm payment
                    </button>
                    <button className="btn secondary" type="button" disabled={busy === `guest-${g.id}`} onClick={() => rejectGuest(g)}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No guest payments are awaiting confirmation.</p>
      )}
    </div>
  );

  const guestKitchenPane = (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Guest Kitchen Orders</h2>
          <p className="muted">Paid guest orders remain visible here until collection.</p>
        </div>
      </div>
      {kitchenGuests.length ? (
        <table className="ops-table">
          <thead>
            <tr>
              <th>TICKET</th>
              <th>GUEST</th>
              <th>MEALS</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {kitchenGuests.map((g) => {
              const next = g.orderStatus === "received" ? "ready" : "collected";
              return (
                <tr key={g.id}>
                  <td>{g.ticketNumber ?? "—"}</td>
                  <td>{g.guestName}</td>
                  <td>{items(g.items)}</td>
                  <td>
                    <span className="tag">{g.orderStatus === "ready" ? "Ready" : "Received"}</span>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={busy === `gk-${g.id}`}
                      onClick={() =>
                        act(`gk-${g.id}`, () => apiSend(`/api/operator/guest-orders/${g.id}`, "POST", { action: next }), `Guest order marked ${next}`)
                      }
                    >
                      {next === "ready" ? "Mark ready" : "Mark collected"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="muted">No paid guest orders are currently in the kitchen queue.</p>
      )}
    </div>
  );

  const walletPane = (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Pending Wallet Top-ups</h2>
          <p className="muted">Confirm only after verifying that the transfer has reached the canteen&apos;s bank account.</p>
        </div>
      </div>
      {o.topups.length ? (
        <table className="ops-table">
          <thead>
            <tr>
              <th>STAFF</th>
              <th>AMOUNT</th>
              <th>REFERENCE</th>
              <th>REQUESTED</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {o.topups.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <strong>{formatMoney(t.amountKobo)}</strong>
                </td>
                <td>{t.reference}</td>
                <td>{fmt.dateTimeShort(t.requestedAt)}</td>
                <td>
                  <span className="tag">Pending</span>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn" type="button" disabled={busy === `topup-${t.id}`} onClick={() => confirmTopup(t)}>
                      Confirm payment
                    </button>
                    <button className="btn secondary" type="button" disabled={busy === `topup-${t.id}`} onClick={() => rejectTopup(t)}>
                      Reject request
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No wallet top-ups are awaiting confirmation.</p>
      )}
    </div>
  );

  const ordersPane = (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Incoming orders</h2>
          <p className="muted">Orders below update automatically. Mark each order ready, then collected when the ticket is shown at the counter.</p>
        </div>
      </div>
      {o.orders.length ? (
        <table className="ops-table">
          <thead>
            <tr>
              <th>ORDER</th>
              <th>STAFF</th>
              <th>ITEMS</th>
              <th>VALUE</th>
              <th>TICKET</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {o.orders.map((x) => {
              const next = x.status === "received" ? "ready" : "collected";
              return (
                <tr key={x.id}>
                  <td>{x.id}</td>
                  <td>{x.name}</td>
                  <td>{items(x.items)}</td>
                  <td>{formatMoney(x.totalKobo)}</td>
                  <td>{x.ticketNumber}</td>
                  <td>
                    <span className="tag">{x.status === "ready" ? "Ready" : "Received"}</span>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={busy === `order-${x.id}`}
                      onClick={() =>
                        act(`order-${x.id}`, () => apiSend(`/api/operator/orders/${x.id}`, "POST", { to: next }), next === "ready" ? "Order marked ready" : "Order collected — ticket used")
                      }
                    >
                      {next === "ready" ? "Mark ready" : "Mark collected"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="muted">No live orders right now. New orders appear here automatically.</p>
      )}
    </div>
  );

  return (
    <>
      <PageHead
        title="Canteen Operator"
        sub="Live order queue, wallet confirmations and menu management."
        action={
          <div className="actions">
            <button className="btn" type="button" onClick={() => router.push("/operator/menu")}>
              Manage menu
            </button>{" "}
            <button className="btn secondary" type="button" onClick={refresh}>
              Refresh
            </button>{" "}
            <button className="btn secondary" type="button" onClick={() => router.push("/portals")}>
              Exit portal
            </button>
          </div>
        }
      />
      <PortalTabs
        title="Canteen Operator"
        toggleLabel="Operator sections"
        storageKey="punch-operator-section"
        tabs={[
          { id: "overview", label: "Overview", content: overviewPane },
          { id: "guest-payments", label: `Guest Payments${pendingGuests.length ? ` (${pendingGuests.length})` : ""}`, content: guestPaymentsPane },
          { id: "guest-orders", label: "Guest Kitchen Orders", content: guestKitchenPane },
          { id: "wallet", label: `Wallet Top-ups${o.topups.length ? ` (${o.topups.length})` : ""}`, content: walletPane },
          { id: "orders", label: `Live Orders${o.orders.length ? ` (${o.orders.length})` : ""}`, content: ordersPane },
        ]}
        links={[
          { label: "Manage Menu", onClick: () => router.push("/operator/menu") },
          {
            label: (
              <>
                Chat
                {unread ? <span className="chat-unread-badge">{unread > 99 ? "99+" : unread}</span> : null}
              </>
            ),
            onClick: () => router.push("/operator/chat"),
          },
        ]}
      />
    </>
  );
}
