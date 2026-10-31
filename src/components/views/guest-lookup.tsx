"use client";
/**
 * Guest order lookup by payment reference (v63 #guest-lookup-form).
 * Shows payment status, the two-step kitchen progress and the guest ticket.
 * Once a reference is shown it refreshes every 10 s, so the guest sees the
 * payment confirmed and the meal turn ready without reloading.
 */
import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";

type GuestOrder = {
  guestName: string;
  totalKobo: number;
  paymentReference: string;
  paymentStatus: "pending" | "confirmed" | "rejected";
  orderStatus: "awaiting_payment" | "received" | "ready" | "collected" | "cancelled";
  ticketNumber: string | null;
  rejectionReason: string | null;
};

export function GuestLookup({
  initialReference = "",
  buttonLabel,
  secondary,
  autoCheck,
}: {
  initialReference?: string;
  buttonLabel: string;
  secondary?: boolean;
  autoCheck?: boolean;
}) {
  const [input, setInput] = useState(initialReference);
  const [reference, setReference] = useState<string | null>(autoCheck && initialReference ? initialReference : null);
  const { data, error, isLoading } = useSWR<{ order: GuestOrder }>(
    reference ? `/api/guest-orders?reference=${encodeURIComponent(reference)}` : null,
    fetcher,
    { refreshInterval: 10_000 },
  );

  useEffect(() => {
    if (!data?.order) return;
    try {
      localStorage.setItem("punch-last-guest-ref", data.order.paymentReference);
    } catch {
      /* ignore */
    }
  }, [data]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (input.trim()) setReference(input.trim());
  }

  return (
    <>
      <form id="guest-lookup-form" onSubmit={submit}>
        <label className="field">
          Payment reference
          <input name="payment_reference" required value={input} onChange={(e) => setInput(e.target.value)} placeholder="GUEST-…" />
        </label>
        <button className={`btn full ${secondary ? "secondary" : ""}`} type="submit">
          {buttonLabel}
        </button>
      </form>
      <div id="guest-lookup-result" aria-live="polite">
        {reference && isLoading ? <p className="muted">Checking…</p> : null}
        {reference && error ? <p role="alert">{(error as Error).message}</p> : null}
        {data?.order ? <GuestStatus order={data.order} /> : null}
      </div>
    </>
  );
}

function GuestStatus({ order: r }: { order: GuestOrder }) {
  const confirmed = r.paymentStatus === "confirmed";
  const ready = r.orderStatus === "ready" || r.orderStatus === "collected";
  const collected = r.orderStatus === "collected";
  const pos = ready ? 1 : 0;
  const title =
    r.paymentStatus === "rejected"
      ? "Payment could not be confirmed"
      : !confirmed
        ? "Awaiting payment confirmation"
        : collected
          ? "Collected — enjoy your meal"
          : ready
            ? "Your meal is ready for pickup"
            : "Order received";
  return (
    <div className={`guest-status-card ${confirmed ? "confirmed" : "pending"}`} style={{ marginTop: 16 }}>
      <span className="eyebrow">PAYMENT {r.paymentStatus.toUpperCase()}</span>
      <h3>{title}</h3>
      <p>
        <strong>{r.guestName}</strong> · {formatMoney(r.totalKobo)}
      </p>
      <p>
        Reference: <span className="guest-ref">{r.paymentReference}</span>
      </p>
      {r.paymentStatus === "rejected" ? (
        <p className="muted">
          {r.rejectionReason ? `Reason: ${r.rejectionReason}. ` : ""}Please speak to the canteen team at the counter.
        </p>
      ) : confirmed ? (
        <ol className="tracking">
          {["Received", "Ready"].map((st, i) => (
            <li key={st} className={i <= pos ? "complete" : ""} aria-current={i === pos ? "step" : undefined}>
              <span>{i + 1}</span>
              {st}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">The kitchen receives your order only after the Operator confirms payment.</p>
      )}
      {r.ticketNumber ? (
        <div className={`digital-ticket ${collected ? "used" : ""}`}>
          <div className="ticket-top">
            <div>
              <span>DIGITAL GUEST TICKET</span>
              <strong>{r.ticketNumber}</strong>
            </div>
            <b>{collected ? "USED" : "VALID"}</b>
          </div>
          <p style={{ padding: "0 18px 16px" }}>
            {collected
              ? "This ticket has been used at the counter."
              : ready
                ? "Your meal is ready. Show this ticket at the canteen counter."
                : "Keep this ticket. You can return here at any time to check your meal status."}
          </p>
        </div>
      ) : r.paymentStatus === "pending" ? (
        <p className="muted">Your ticket will appear here after the Operator confirms payment.</p>
      ) : null}
    </div>
  );
}
