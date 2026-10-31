"use client";
/**
 * Staff account (v63 "account" view): identity, live Weekly Ticket and
 * Personal Wallet balances, and wallet top-up by bank transfer.
 * Top-up requests refresh every 10 s, so a confirmation from the canteen
 * shows up here (with the new balance) without reloading. Rejected requests
 * now show the operator's reason when one was given.
 */
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { PageHead, fmt } from "@/components/page-head";
import { apiSend, fetcher } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import type { AccountData } from "@/server/loaders";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "AWAITING OPERATOR CONFIRMATION", cls: "pending" },
  confirmed: { label: "CONFIRMED & CREDITED", cls: "credited" },
  rejected: { label: "REJECTED", cls: "rejected" },
};

export function AccountView({ initial }: { initial: AccountData }) {
  const router = useRouter();
  const { me, refreshMe, toast } = useApp();
  const { data, mutate } = useSWR<{ account: AccountData }>("/api/topups", fetcher, {
    fallbackData: { account: initial },
    refreshInterval: 10_000,
    onSuccess: () => refreshMe(),
  });
  const account = data?.account ?? initial;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!me) return null;
  const initials = me.user.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  async function signOut() {
    await apiSend("/api/auth/sign-out", "POST");
    await refreshMe();
    router.push("/login");
    router.refresh();
    toast("Signed out");
  }

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(account.bank.accountNumber);
      toast("Account number copied");
    } catch {
      toast(`Account number: ${account.bank.accountNumber}`);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const amount = Number(new FormData(form).get("amount"));
    setError("");
    if (!amount || amount < 100) return setError("Enter the amount you transferred.");
    setBusy(true);
    try {
      const res = await apiSend<{ topup: { reference: string } }>("/api/topups", "POST", { amount });
      form.reset();
      await mutate();
      toast(`Top-up request submitted · ${res.topup.reference}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Staff account" sub="Your identity, company meal benefit and personal wallet in one place." />
      <div className="staff-account">
        <div className="profile-card">
          <span className="eyebrow">PUNCH STAFF</span>
          <div className="profile-id">
            <div className="profile-avatar">{initials}</div>
            <div>
              <h2>{me.user.fullName}</h2>
              <p>{me.user.email}</p>
            </div>
          </div>
          <div className="account-balances account-balances-labelled">
            <div className="balance-card">
              <h3>Weekly Ticket</h3>
              <strong>{formatMoney(me.user.weeklyTicketKobo)}</strong>
              <small>Current Weekly Ticket balance</small>
            </div>
            <div className="balance-card">
              <h3>Personal Wallet</h3>
              <strong>{formatMoney(me.user.walletKobo)}</strong>
              <small>Your personal funds</small>
            </div>
          </div>
          <button className="btn secondary full logout" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>

        <div className="panel" style={{ margin: 0 }}>
          <h2>Top up Personal Wallet</h2>
          <p className="muted">
            Transfer to the canteen account below, then submit the amount you transferred. Your wallet is credited only after the Canteen
            Operator confirms receipt.
          </p>
          <div className="payment-box">
            <div className="payline">
              <span>Bank</span>
              <strong>{account.bank.name}</strong>
            </div>
            <div className="payline">
              <span>Account number</span>
              <strong>{account.bank.accountNumber}</strong>
            </div>
            <div className="payline">
              <span>Account name</span>
              <strong>{account.bank.accountName}</strong>
            </div>
            <button type="button" className="btn secondary full" style={{ marginTop: 12 }} onClick={copyAccount}>
              Copy account number
            </button>
          </div>
          <form id="bank-transfer-form" onSubmit={submit}>
            <label className="field">
              Amount transferred (₦)
              <input name="amount" type="number" min={100} step={100} required placeholder="5000" />
            </label>
            <button className="btn full" style={{ marginTop: 12 }} type="submit" disabled={busy}>
              {busy ? "Submitting…" : "Submit top-up request"}
            </button>
            <p id="topup-error" role="alert" className="form-error">
              {error}
            </p>
          </form>

          {account.topups.length ? (
            <div style={{ marginTop: 24 }}>
              <h3>Recent top-up requests</h3>
              {account.topups.map((t) => {
                const st = STATUS[t.status]!;
                return (
                  <div className="bank-panel" style={{ marginTop: 12 }} key={t.id}>
                    <div className="panel-head">
                      <strong>{formatMoney(t.amountKobo)}</strong>
                      <span className={`transfer-status ${st.cls}`}>{st.label}</span>
                    </div>
                    <p>
                      <b>Reference:</b> {t.reference}
                    </p>
                    {t.status === "rejected" && t.rejectionReason ? (
                      <p>
                        <b>Reason:</b> {t.rejectionReason}
                      </p>
                    ) : null}
                    <p className="muted">Requested {fmt.dateTime(t.requestedAt)}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={{ marginTop: 25 }}>
            <h3>How top-up works</h3>
            <ol className="steps">
              <li>Transfer money to the {account.bank.name.replace(/ Bank$/, "")} account shown above.</li>
              <li>Submit the amount you transferred.</li>
              <li>The Canteen Operator verifies and confirms the payment.</li>
              <li>Once confirmed, the full amount enters your Personal Wallet.</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
