/**
 * Portal chooser, portal sign-in pages and "Access restricted"
 * (v63 "admin", "operator-login", "canteen-admin-login", "access-denied").
 * Server components: no interactivity needed.
 */
import Link from "next/link";
import { PageHead } from "@/components/page-head";

export function PortalChooser() {
  return (
    <>
      <PageHead
        title="Operations / Oversight"
        sub="Choose the portal for your role. Use one Magic Link account for all portals. Your assigned role determines access."
      />
      <div className="portal-chooser">
        <div className="portal-card">
          <div className="portal-icon">O</div>
          <span className="ops-badge">CANTEEN OPERATOR</span>
          <h2 style={{ marginTop: 10 }}>Service operations</h2>
          <p className="muted">For the team running the canteen each day.</p>
          <ul>
            <li>See incoming staff orders</li>
            <li>Update order status in real time</li>
            <li>Manage meals and availability</li>
            <li>Change menu prices</li>
          </ul>
          <Link className="btn full" href="/operator/sign-in">
            Open Operator Portal →
          </Link>
        </div>
        <div className="portal-card">
          <div className="portal-icon">A</div>
          <span className="ops-badge">CANTEEN ADMIN</span>
          <h2 style={{ marginTop: 10 }}>Reviews &amp; management data</h2>
          <p className="muted">For management oversight and reporting.</p>
          <ul>
            <li>See registered staff balances</li>
            <li>Allocate Weekly Tickets</li>
            <li>Track Weekly Ticket and Personal Wallet balances</li>
            <li>Management oversight</li>
          </ul>
          <Link className="btn full" href="/admin/sign-in">
            Open Admin Portal →
          </Link>
        </div>
      </div>
    </>
  );
}

/** v63 told people to "return here" after signing in; the link now brings them straight back (N7). */
export function PortalSignIn({ portal }: { portal: "operator" | "admin" }) {
  const name = portal === "operator" ? "Operator" : "Admin";
  const target = portal === "operator" ? "/operator" : "/admin";
  return (
    <>
      <PageHead title={`Canteen ${name} access`} sub="Sign in with your approved staff email. No password is needed." />
      <div className="panel portal-login">
        <h2>{name} access</h2>
        <p className="muted">Use your regular Magic Link sign-in. The link in your email brings you straight back to the {name} Portal.</p>
        <Link className="btn full" href={`/login?next=${encodeURIComponent(target)}`}>
          Sign in with Magic Link →
        </Link>
        <Link className="btn secondary full" style={{ marginTop: 10 }} href="/portals">
          ← Back to portals
        </Link>
      </div>
    </>
  );
}

export function AccessDenied() {
  return (
    <>
      <PageHead title="Access restricted" sub="Your staff account does not have permission to open this portal." />
      <div className="panel">
        <p>Contact the Canteen Hub administrator if your role should include this access.</p>
        <Link className="btn" href="/">
          Return to Home
        </Link>
      </div>
    </>
  );
}
