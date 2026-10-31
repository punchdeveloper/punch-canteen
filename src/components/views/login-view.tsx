"use client";
/**
 * Staff sign-in and "Check your email" (v63 "login" and "activate" views).
 * The page you were heading for (?next=/operator etc.) is sent with the
 * request and travels inside the emailed link.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { apiSend } from "@/lib/client/api";

const EMAIL_KEY = "punch-magic-email";
const NEXT_KEY = "punch-magic-next";

const LINK_ERRORS: Record<string, string> = {
  invalid: "That sign-in link isn't valid. Please request a new one.",
  expired: "That sign-in link has expired. Please request a new one.",
  used: "That sign-in link has already been used. Please request a new one.",
  blocked: "This account can't sign in. Please contact the Canteen Hub administrator.",
};

export function LoginView({ next, linkError }: { next: string | null; linkError: string | null }) {
  const router = useRouter();
  const { setGuest, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(linkError ? LINK_ERRORS[linkError] ?? "" : "");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") || "").trim().toLowerCase();
    setError("");
    setBusy(true);
    try {
      await apiSend("/api/auth/request-link", "POST", { email, next });
      sessionStorage.setItem(EMAIL_KEY, email);
      if (next) sessionStorage.setItem(NEXT_KEY, next);
      else sessionStorage.removeItem(NEXT_KEY);
      router.push("/login/check-email");
      toast("Sign-in link sent");
    } catch (err) {
      setError((err as Error).message || "Could not send sign-in link.");
      setBusy(false);
    }
  }

  function continueAsGuest() {
    setGuest(true);
    router.push("/");
    toast("Continuing as guest");
  }

  return (
    <div className="login-shell">
      <form id="login-form" className="login-card" onSubmit={submit}>
        <Link className="login-logo" href="/" aria-label="Return to home page" title="Return to home page" style={{ textDecoration: "none" }}>
          P
        </Link>
        <span className="eyebrow">PUNCH CANTEEN</span>
        <h1>Staff sign-in</h1>
        <p className="muted">Enter your approved staff email address. We will email you a secure sign-in link — no password required.</p>
        <label className="field">
          Approved staff email address
          <input name="email" type="email" required autoComplete="email" placeholder="name@punchng.com" />
        </label>
        <button className="btn full" style={{ marginTop: 20 }} type="submit" disabled={busy}>
          {busy ? "Sending link…" : "Send sign-in link →"}
        </button>
        <button type="button" className="btn secondary full" style={{ marginTop: 10 }} onClick={continueAsGuest}>
          Sign in as a guest
        </button>
        <p id="login-error" role="alert" style={{ marginTop: 12, color: "#ba2536" }}>
          {error}
        </p>
        <Link className="text-btn" href="/" style={{ display: "block", margin: "16px auto 0", textAlign: "center" }}>
          ← Back to Home
        </Link>
        <div className="login-help">Only staff pre-approved in the PUNCH Canteen Staff Directory can complete sign-in.</div>
      </form>
    </div>
  );
}

export function CheckEmailView() {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setEmail(sessionStorage.getItem(EMAIL_KEY)), 0);
    return () => clearTimeout(t);
  }, []);

  async function resend() {
    if (!email) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      await apiSend("/api/auth/request-link", "POST", { email, next: sessionStorage.getItem(NEXT_KEY) });
      setOk("A new sign-in link has been sent.");
    } catch (err) {
      setError((err as Error).message || "Could not resend sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <Link className="login-logo" href="/" aria-label="Return to home page" title="Return to home page" style={{ textDecoration: "none" }}>
          P
        </Link>
        <span className="eyebrow">PUNCH CANTEEN</span>
        <h1>Check your email</h1>
        <p className="muted">
          If <strong>{email ?? "your email"}</strong> is in the PUNCH Canteen Staff Directory, we have sent it a secure sign-in link.
        </p>
        <p className="muted" style={{ marginTop: 12 }}>
          Open the email and click <strong>Sign in</strong>. You will return to PUNCH Canteen automatically.
        </p>
        {email ? (
          <button type="button" className="btn full" style={{ marginTop: 20 }} onClick={resend} disabled={busy}>
            {busy ? "Sending…" : "Resend sign-in link"}
          </button>
        ) : null}
        <Link className="btn secondary full" style={{ marginTop: 10 }} href="/login">
          Use another email
        </Link>
        <p id="activate-error" role="alert" style={{ marginTop: 12, color: "#ba2536" }}>
          {error}
        </p>
        <p id="activate-success" role="status" style={{ marginTop: 12, color: "#253c37" }}>
          {ok}
        </p>
        <Link className="text-btn" href="/" style={{ display: "block", margin: "16px auto 0", textAlign: "center" }}>
          ← Back to Home
        </Link>
        <div className="login-help">For security, sign-in links expire after 15 minutes and can only be used once.</div>
      </div>
    </div>
  );
}
