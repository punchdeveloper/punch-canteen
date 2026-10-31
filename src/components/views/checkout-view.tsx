"use client";
/**
 * Checkout (v63 "checkout" view).
 *
 * Staff: automatic payment — Weekly Ticket first, then Personal Wallet. If the
 * balance is short, the message links straight to the top-up page (review #7).
 * Guest: name + phone, pay by bank transfer, submit a payment request. After
 * submitting, the guest is taken to "Track guest order" with the reference
 * filled in (v63 only showed the reference in a 4-second toast).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useApp, useCartLines } from "@/components/providers";
import { PageHead } from "@/components/page-head";
import { CartLines } from "@/components/views/cart-view";
import { apiSend } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import { GuestLookup } from "@/components/views/guest-lookup";

type Bank = { name: string; accountNumber: string; accountName: string };

export const LAST_GUEST_REF_KEY = "punch-last-guest-ref";

export function CheckoutView({ bank }: { bank: Bank }) {
  const { me, guest, cartTotalKobo } = useApp();
  const total = cartTotalKobo;

  return (
    <>
      <PageHead
        title="Checkout"
        sub={guest ? "Guest payment must be confirmed before your meal order becomes valid." : "One final check before placing your order."}
      />
      {!total ? (
        <div className="panel empty">
          Your cart is empty.{" "}
          <Link className="btn" href="/menu">
            Browse menu
          </Link>
        </div>
      ) : guest ? (
        <GuestCheckout bank={bank} />
      ) : (
        <StaffCheckout name={me?.user.fullName ?? "PUNCH Staff"} />
      )}
    </>
  );
}

function Summary({ children }: { children?: React.ReactNode }) {
  const { cartTotalKobo } = useApp();
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Order summary</h2>
        <Link className="text-btn" href="/cart">
          Edit
        </Link>
      </div>
      <CartLines />
      <div className="row total">
        <span>Total</span>
        <span>{formatMoney(cartTotalKobo)}</span>
      </div>
      {children}
    </div>
  );
}

function StaffCheckout({ name }: { name: string }) {
  const router = useRouter();
  const { me, refreshMe, cartTotalKobo, clearCart, toast } = useApp();
  const lines = useCartLines();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const weekly = me?.user.weeklyTicketKobo ?? 0;
  const wallet = me?.user.walletKobo ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!me) return setError("Please sign in with your PUNCH staff account to place an order.");
    if (cartTotalKobo > weekly + wallet) return setError(shortfall(cartTotalKobo - weekly - wallet));
    setBusy(true);
    try {
      const res = await apiSend<{ order: { ticketNumber: string } }>("/api/orders", "POST", {
        items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })),
      });
      clearCart();
      await refreshMe();
      router.push("/orders");
      toast(`Order placed · ticket ${res.order.ticketNumber}`);
    } catch (err) {
      const message = (err as Error).message;
      // The server is the source of truth for balances; refresh and explain.
      await refreshMe();
      setError(/insufficient/i.test(message) ? shortfall(null) : message || "Could not place your order. Your cart has been preserved.");
      setBusy(false);
    }
  }

  return (
    <div className="columns">
      <form className="panel" onSubmit={submit}>
        <h2>Order payment</h2>
        <p>
          <strong>{name}</strong>
        </p>
        <p className="muted">Pickup location: canteen counter.</p>
        <div className="payment-box">
          <span className="eyebrow">AUTOMATIC PAYMENT</span>
          <div className="payline">
            <span>Weekly Ticket available</span>
            <strong>{formatMoney(weekly)}</strong>
          </div>
          <div className="payline">
            <span>Personal Wallet available</span>
            <strong>{formatMoney(wallet)}</strong>
          </div>
          <div className="payline due">
            <span>Order total</span>
            <strong>{formatMoney(cartTotalKobo)}</strong>
          </div>
          <p className="muted">Weekly Ticket is used first, then Personal Wallet. Your available balance must cover the full order.</p>
        </div>
        <button className="btn full" type="submit" disabled={busy}>
          {busy ? "Placing order…" : `Place order & generate digital ticket · ${formatMoney(cartTotalKobo)}`}
        </button>
        <div id="checkout-error" role="alert">
          {error}
        </div>
      </form>
      <Summary />
    </div>
  );
}

/** "Insufficient balance" message with a way out (review bug #7). */
function shortfall(kobo: number | null) {
  return (
    <>
      Insufficient balance. {kobo ? `Please top up ${formatMoney(kobo)} to complete this order.` : "Please top up your wallet to complete this order."}{" "}
      <Link className="btn secondary" href="/account" style={{ marginTop: 10, display: "flex", maxWidth: 240 }}>
        Top up wallet →
      </Link>
    </>
  );
}

function GuestCheckout({ bank }: { bank: Bank }) {
  const router = useRouter();
  const { cartTotalKobo, clearCart, toast } = useApp();
  const lines = useCartLines();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    try {
      const res = await apiSend<{ paymentReference: string }>("/api/guest-orders", "POST", {
        guestName: String(f.get("guest_name") || ""),
        phoneNumber: String(f.get("phone_number") || ""),
        items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })),
      });
      try {
        localStorage.setItem(LAST_GUEST_REF_KEY, res.paymentReference);
      } catch {
        /* ignore */
      }
      clearCart();
      toast(`Payment request submitted · ${res.paymentReference}`);
      router.push(`/orders?reference=${encodeURIComponent(res.paymentReference)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="guest-pay-grid">
      <form id="guest-checkout-form" className="panel" onSubmit={submit}>
        <h2>Guest checkout</h2>
        <p className="muted">Enter your details, transfer the exact amount to the canteen account, then submit your payment request.</p>
        <label className="field">
          Your name
          <input name="guest_name" required maxLength={100} placeholder="Full name" autoComplete="name" />
        </label>
        <label className="field">
          Phone number
          <input name="phone_number" required maxLength={30} inputMode="tel" placeholder="080…" autoComplete="tel" />
        </label>
        <div className="payment-box">
          <span className="eyebrow">PAY BY BANK TRANSFER</span>
          <div className="payline">
            <span>Bank</span>
            <strong>{bank.name}</strong>
          </div>
          <div className="payline">
            <span>Account number</span>
            <strong>{bank.accountNumber}</strong>
          </div>
          <div className="payline">
            <span>Account name</span>
            <strong>{bank.accountName}</strong>
          </div>
          <div className="payline due">
            <span>Amount to pay</span>
            <strong>{formatMoney(cartTotalKobo)}</strong>
          </div>
        </div>
        <p className="muted">Your food ticket will be generated only after the Canteen Operator confirms that payment has been received.</p>
        <button className="btn full" type="submit" disabled={busy}>
          {busy ? "Submitting…" : `Submit guest payment request · ${formatMoney(cartTotalKobo)}`}
        </button>
        <p id="guest-checkout-error" role="alert" className="form-error">
          {error}
        </p>
      </form>
      <Summary>
        <hr />
        <h2>Already paid?</h2>
        <p className="muted">Use your guest payment reference to check confirmation and retrieve your digital ticket.</p>
        <GuestLookup buttonLabel="Check guest order" secondary />
      </Summary>
    </div>
  );
}
