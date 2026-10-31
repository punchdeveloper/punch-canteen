"use client";
/**
 * Canteen Admin portal (v63 "canteen-admin" view).
 *
 * Sections: Overview, Financial Oversight, Staff Reviews, Staff Management,
 * Weekly Ticket, System Maintenance. Data refreshes every 15 s.
 *
 * Fixes from the review / database check:
 *   N2  data is there on first load and after refresh (no blank directory)
 *   N8  each section shows only its own panels
 *   N11 checkbox labels sit next to their checkboxes
 *   *   admins can't remove/suspend/demote themselves; the master admin row is
 *       protected (enforced on the server too)
 *   *   the history-clearing tools only appear on test servers
 */
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useMemo, useState, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { PageHead, fmt } from "@/components/page-head";
import { PortalTabs } from "@/components/portal-tabs";
import { apiSend, fetcher } from "@/lib/client/api";
import { formatMoney, WEEKLY_TICKET_OPTIONS_KOBO, koboToNaira } from "@/lib/money";
import type { AdminOverview } from "@/server/loaders";

type Person = AdminOverview["directory"][number];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const human = (s: string) => s.replaceAll("_", " ");

export function AdminView({ initial }: { initial: AdminOverview }) {
  const router = useRouter();
  const { me, refreshMe, toast } = useApp();
  const { data, mutate } = useSWR<{ overview: AdminOverview }>("/api/admin/overview", fetcher, {
    fallbackData: { overview: initial },
    refreshInterval: 15_000,
  });
  const o = data?.overview ?? initial;
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, fn: () => Promise<unknown>, success: string | ((r: unknown) => string)) {
    setBusy(key);
    try {
      const r = await fn();
      await Promise.all([mutate(), refreshMe()]);
      toast(typeof success === "function" ? success(r) : success);
      return true;
    } catch (err) {
      toast((err as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    await mutate();
    toast("Admin data refreshed");
  }

  return (
    <>
      <PageHead
        title="Canteen Admin"
        sub="Live staff balances and Weekly Ticket allocation."
        action={
          <div className="actions">
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
        title="Canteen Admin"
        toggleLabel="Admin sections"
        storageKey="punch-admin-section"
        tabs={[
          { id: "overview", label: "Overview", content: <Overview o={o} /> },
          { id: "financial", label: "Financial Oversight", content: <Financial o={o} /> },
          { id: "reviews", label: "Staff Reviews", content: <Reviews o={o} /> },
          { id: "staff", label: "Staff Management", content: <StaffManagement o={o} selfId={me?.user.id ?? ""} act={act} busy={busy} /> },
          { id: "weekly", label: "Weekly Ticket", content: <WeeklyTicket o={o} act={act} busy={busy} /> },
          { id: "maintenance", label: "System Maintenance", content: <Maintenance o={o} act={act} busy={busy} /> },
        ]}
      />
    </>
  );
}

type Act = (key: string, fn: () => Promise<unknown>, success: string | ((r: unknown) => string)) => Promise<boolean>;

// ---------------------------------------------------------------------------

function Overview({ o }: { o: AdminOverview }) {
  const s = o.summary;
  return (
    <div className="analytics-grid">
      <div className="analytic">
        <span>TOTAL ORDER VALUE</span>
        <strong>{formatMoney(s.totalOrderValueKobo)}</strong>
      </div>
      <div className="analytic">
        <span>WEEKLY TICKET ALLOCATIONS</span>
        <strong>{formatMoney(s.totalWeeklyAllocationsKobo)}</strong>
      </div>
      <div className="analytic">
        <span>CONFIRMED WALLET TOP-UPS</span>
        <strong>{formatMoney(s.totalConfirmedTopupsKobo)}</strong>
      </div>
      <div className="analytic">
        <span>TOTAL ORDERS</span>
        <strong>{s.totalOrders}</strong>
      </div>
      <div className="analytic">
        <span>STAFF ACCOUNTS</span>
        <strong>{s.totalStaff}</strong>
      </div>
    </div>
  );
}

function Financial({ o }: { o: AdminOverview }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return o.transactions.filter(
      (x) => !t || [x.staffName, x.staffEmail, x.type, x.account, x.reference, x.description].some((v) => String(v ?? "").toLowerCase().includes(t)),
    );
  }, [o.transactions, q]);
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Financial oversight</h2>
          <p className="muted">Live management totals and the latest financial activity (newest first).</p>
        </div>
      </div>
      <label className="field" style={{ maxWidth: 520 }}>
        Search transactions
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Staff name, email, reference, type or description" />
      </label>
      <div style={{ overflowX: "auto" }}>
        {rows.length ? (
          <table className="ops-table">
            <thead>
              <tr>
                <th>DATE / TIME</th>
                <th>STAFF</th>
                <th>TYPE</th>
                <th>ACCOUNT</th>
                <th>AMOUNT</th>
                <th>BALANCE AFTER</th>
                <th>REFERENCE</th>
                <th>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td>{fmt.dateTimeShort(x.createdAt)}</td>
                  <td>
                    <strong>{x.staffName}</strong>
                    <br />
                    <span className="muted">{x.staffEmail}</span>
                  </td>
                  <td>
                    <span className="tag">{human(x.type)}</span>
                  </td>
                  <td>{human(x.account)}</td>
                  <td>
                    <strong>
                      {x.amountKobo > 0 ? "+" : ""}
                      {formatMoney(x.amountKobo)}
                    </strong>
                  </td>
                  <td>{formatMoney(x.balanceAfterKobo)}</td>
                  <td>{x.reference ?? "—"}</td>
                  <td>{x.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">{q ? "No transactions match your search." : "No financial transactions yet."}</p>
        )}
      </div>
    </div>
  );
}

function Reviews({ o }: { o: AdminOverview }) {
  const [q, setQ] = useState("");
  const food = o.foodReviews;
  const avg = food.length ? food.reduce((n, r) => n + r.rating, 0) / food.length : 0;
  const filtered = food.filter(
    (r) => !q.trim() || [r.staffName, r.staffEmail, r.menuItem, r.comment].some((v) => String(v ?? "").toLowerCase().includes(q.trim().toLowerCase())),
  );
  const x = o.experience.summary;
  const score = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} / 5`);
  return (
    <>
      <div className="panel" style={{ marginBottom: 18 }}>
        <h2>Food Reviews</h2>
        <div className="analytics-grid">
          <div className="analytic">
            <span>TOTAL FOOD REVIEWS</span>
            <strong>{food.length}</strong>
          </div>
          <div className="analytic">
            <span>AVERAGE FOOD RATING</span>
            <strong>{food.length ? `${avg.toFixed(1)} / 5` : "—"}</strong>
          </div>
          <div className="analytic">
            <span>5-STAR REVIEWS</span>
            <strong>{food.filter((r) => r.rating === 5).length}</strong>
          </div>
        </div>
        <label className="field" style={{ maxWidth: 520 }}>
          Search food reviews
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Staff, menu item or comment" />
        </label>
        <div style={{ overflowX: "auto" }}>
          <table className="ops-table">
            {filtered.length ? (
              <>
                <thead>
                  <tr>
                    <th>STAFF</th>
                    <th>MENU ITEM</th>
                    <th>RATING</th>
                    <th>COMMENT</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.staffName}</strong>
                        <br />
                        <span className="muted">{r.staffEmail}</span>
                      </td>
                      <td>{r.menuItem}</td>
                      <td>
                        <strong>{"★".repeat(r.rating)}</strong>
                        <br />
                        <span className="muted">{r.rating}/5</span>
                      </td>
                      <td>{r.comment || "—"}</td>
                      <td>{fmt.dateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <tbody>
                <tr>
                  <td className="muted">{q ? "No reviews match your search." : "No staff reviews yet."}</td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Canteen Experience</h2>
            <p className="muted">Ratings for the wider canteen environment and service.</p>
          </div>
          <strong>
            {x.totalReviews} review{x.totalReviews === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="analytics-grid">
          {(
            [
              ["OVERALL", x.overallRating],
              ["ENVIRONMENT", x.environmentRating],
              ["RESTROOM", x.restroomRating],
              ["AMBIENCE", x.ambienceRating],
              ["CUSTOMER SERVICE", x.customerServiceRating],
              ["SPEED OF SERVICE", x.speedOfServiceRating],
              ["FOOD PRESENTATION", x.foodPresentationRating],
            ] as const
          ).map(([label, v]) => (
            <div className="analytic" key={label}>
              <span>{label}</span>
              <strong>{score(v)}</strong>
            </div>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="ops-table">
            {o.experience.reviews.length ? (
              <>
                <thead>
                  <tr>
                    <th>STAFF</th>
                    <th>ENVIRONMENT</th>
                    <th>RESTROOM</th>
                    <th>AMBIENCE</th>
                    <th>SERVICE</th>
                    <th>SPEED</th>
                    <th>PRESENTATION</th>
                    <th>OVERALL</th>
                    <th>COMMENT</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {o.experience.reviews.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.staffName}</strong>
                        <br />
                        <span className="muted">{r.staffEmail}</span>
                      </td>
                      <td>{r.environmentRating}/5</td>
                      <td>{r.restroomRating}/5</td>
                      <td>{r.ambienceRating}/5</td>
                      <td>{r.customerServiceRating}/5</td>
                      <td>{r.speedOfServiceRating}/5</td>
                      <td>{r.foodPresentationRating}/5</td>
                      <td>
                        <strong>{r.overallRating}/5</strong>
                      </td>
                      <td>{r.comment || "—"}</td>
                      <td>{fmt.dateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <tbody>
                <tr>
                  <td className="muted">No canteen experience reviews yet.</td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function StaffManagement({ o, selfId, act, busy }: { o: AdminOverview; selfId: string; act: Act; busy: string | null }) {
  const [addError, setAddError] = useState("");
  const [csvStatus, setCsvStatus] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [roles, setRoles] = useState<Record<string, string>>({});

  async function addOne(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fullName = String(f.get("full_name") || "").trim();
    setAddError("");
    try {
      await apiSend("/api/admin/staff", "POST", { fullName, email: String(f.get("email") || ""), role: String(f.get("role") || "staff") });
      setFormKey((k) => k + 1);
      await act("noop", async () => {}, `${fullName} added to staff directory`);
    } catch (err) {
      setAddError((err as Error).message);
    }
  }

  async function importCsv(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCsvStatus("Reading CSV…");
    try {
      const r = await apiSend<{ added: number; skipped: number }>("/api/admin/staff/import", "POST", new FormData(e.currentTarget));
      setCsvStatus(r.skipped ? `${r.skipped} already in the directory were skipped.` : "");
      setFormKey((k) => k + 1);
      await act("noop", async () => {}, `${r.added} staff added from CSV`);
    } catch (err) {
      setCsvStatus((err as Error).message);
    }
  }

  function saveRole(p: Person) {
    const role = roles[p.id] ?? p.role;
    if (role === p.role) return;
    if (!confirm(`Change ${p.fullName}'s role to ${role.toUpperCase()}?`)) return;
    act(`role-${p.id}`, () => apiSend(`/api/admin/staff/${p.id}`, "PATCH", { role }), `${p.fullName}'s role updated. It applies on their next page load.`);
  }

  function setStatus(p: Person, status: "active" | "suspended" | "deactivated") {
    const verb = status === "active" ? "Reactivate" : status === "suspended" ? "Suspend" : "Deactivate";
    const warning =
      status === "deactivated"
        ? `Deactivate ${p.fullName}'s PUNCH Canteen account? Their historical records will be preserved, but they will not be able to sign in.`
        : `${verb} ${p.fullName}'s PUNCH Canteen account?`;
    if (!confirm(warning)) return;
    act(`status-${p.id}`, () => apiSend(`/api/admin/staff/${p.id}`, "PATCH", { status }), `${p.fullName}: ${status}`);
  }

  function remove(p: Person) {
    const typed = prompt(
      `Remove ${p.fullName} from the canteen system? Their historical orders and transactions will be preserved, but their canteen access will be disabled.\n\nType REMOVE to confirm.`,
    );
    if (typed === null) return;
    if (typed !== "REMOVE") return void act("noop", async () => {}, "Removal cancelled — type REMOVE exactly");
    act(`remove-${p.id}`, () => apiSend(`/api/admin/staff/${p.id}`, "DELETE"), `${p.fullName} removed from Staff Directory`);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Staff Management</h2>
          <p className="muted">Pre-approve employees for PUNCH Canteen. Add one person or import a CSV. Bulk imports are added as Staff by default.</p>
        </div>
      </div>
      <div className="columns" style={{ alignItems: "start" }} key={formKey}>
        <form className="panel" style={{ margin: 0 }} onSubmit={addOne}>
          <h3>Add one employee</h3>
          <label className="field">
            Full name
            <input name="full_name" required maxLength={120} placeholder="Employee full name" />
          </label>
          <label className="field">
            Work email
            <input name="email" type="email" required maxLength={160} placeholder="name@punchng.com" />
          </label>
          <label className="field">
            Role
            <select name="role" defaultValue="staff">
              <option value="staff">Staff</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="btn full" type="submit">
            Add to staff directory
          </button>
          <p role="alert" className="form-error">
            {addError}
          </p>
        </form>
        <form className="panel" style={{ margin: 0 }} onSubmit={importCsv}>
          <h3>Bulk add by CSV</h3>
          <p className="muted">
            CSV columns: <b>full_name,email</b>. Everyone imported here is assigned the Staff role.
          </p>
          <label className="field">
            CSV file
            <input name="csv" type="file" accept=".csv,text/csv" required />
          </label>
          <button className="btn full" type="submit">
            Import staff CSV
          </button>
          <p className="muted" style={{ marginTop: 10 }}>
            {csvStatus}
          </p>
        </form>
      </div>

      <div style={{ overflowX: "auto", marginTop: 22 }}>
        <table className="ops-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th>ROLE</th>
              <th>STATUS</th>
              <th>ADDED</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {o.directory.length ? (
              o.directory.map((p) => {
                const self = p.id === selfId;
                const locked = p.isMaster || self; // can't be demoted, suspended or removed here
                const statusCls = p.status === "suspended" || p.status === "deactivated" ? "red" : p.status === "invited" ? "warn" : "";
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.fullName}</strong>
                      {p.isMaster ? (
                        <>
                          <br />
                          <span className="muted">Master administrator</span>
                        </>
                      ) : self ? (
                        <>
                          <br />
                          <span className="muted">You</span>
                        </>
                      ) : null}
                    </td>
                    <td>{p.email}</td>
                    <td>
                      <select
                        aria-label={`Role for ${p.fullName}`}
                        value={roles[p.id] ?? p.role}
                        onChange={(e) => setRoles((r) => ({ ...r, [p.id]: e.target.value }))}
                        style={{ minWidth: 105, padding: 8, border: "1px solid #d8dde3", borderRadius: 8 }}
                      >
                        <option value="staff" disabled={locked}>
                          Staff
                        </option>
                        <option value="operator" disabled={locked}>
                          Operator
                        </option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`tag ${statusCls}`}>{p.status.toUpperCase()}</span>
                    </td>
                    <td>{fmt.date(p.createdAt)}</td>
                    <td>
                      <div className="actions">
                        <button className="btn secondary" type="button" disabled={busy === `role-${p.id}` || (roles[p.id] ?? p.role) === p.role} onClick={() => saveRole(p)}>
                          Save role
                        </button>
                        {locked ? null : p.status === "suspended" ? (
                          <>
                            <button className="btn" type="button" onClick={() => setStatus(p, "active")}>
                              Reactivate
                            </button>
                            <button className="btn secondary" type="button" onClick={() => setStatus(p, "deactivated")}>
                              Deactivate
                            </button>
                          </>
                        ) : p.status === "deactivated" ? (
                          <button className="btn" type="button" onClick={() => setStatus(p, "active")}>
                            Reactivate
                          </button>
                        ) : (
                          <>
                            <button className="btn secondary" type="button" onClick={() => setStatus(p, "suspended")}>
                              Suspend
                            </button>
                            <button className="btn secondary" type="button" onClick={() => setStatus(p, "deactivated")}>
                              Deactivate
                            </button>
                          </>
                        )}
                        {locked ? null : (
                          <button className="btn secondary" type="button" disabled={busy === `remove-${p.id}`} onClick={() => remove(p)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="muted">
                  No employees have been added to the staff directory yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WeeklyTicket({ o, act, busy }: { o: AdminOverview; act: Act; busy: string | null }) {
  // Only people who can actually receive a Weekly Ticket.
  const people = o.directory.filter((p) => p.status === "active" || p.status === "invited");
  const [bulkAmount, setBulkAmount] = useState(WEEKLY_TICKET_OPTIONS_KOBO[0]!);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowAmount, setRowAmount] = useState<Record<string, number>>({});
  const allChecked = people.length > 0 && selected.size === people.length;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function creditBulk() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Credit ${ids.length} staff member${ids.length === 1 ? "" : "s"} with ${formatMoney(bulkAmount)} each? Total allocation: ${formatMoney(ids.length * bulkAmount)}.`)) return;
    act(
      "bulk",
      () => apiSend("/api/admin/weekly-tickets", "POST", { userIds: ids, amount: koboToNaira(bulkAmount) }),
      (r) => {
        const res = r as { staffProcessed: number; totalAllocatedKobo: number };
        return `${res.staffProcessed} staff credited · ${formatMoney(res.totalAllocatedKobo)} total`;
      },
    ).then((ok) => ok && setSelected(new Set()));
  }

  function creditOne(p: Person) {
    const amount = rowAmount[p.id] ?? WEEKLY_TICKET_OPTIONS_KOBO[0]!;
    if (!confirm(`Credit ${p.fullName} with ${formatMoney(amount)} Weekly Ticket?`)) return;
    act(`credit-${p.id}`, () => apiSend("/api/admin/weekly-tickets", "POST", { userIds: [p.id], amount: koboToNaira(amount) }), `${p.fullName} credited with ${formatMoney(amount)}`);
  }

  const amountOptions = WEEKLY_TICKET_OPTIONS_KOBO.map((k) => (
    <option key={k} value={k}>
      {formatMoney(k)}
    </option>
  ));

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Bulk Weekly Ticket allocation</h2>
            <p className="muted">Select staff, choose one amount and credit everyone in one secure operation. The selected Weekly Ticket amount is credited to each staff member.</p>
          </div>
        </div>
        {people.length ? (
          <div className="menu-edit" style={{ alignItems: "end" }}>
            <label className="field">
              Bulk amount
              <select value={bulkAmount} onChange={(e) => setBulkAmount(Number(e.target.value))}>
                {amountOptions}
              </select>
            </label>
            <div>
              <label className="check-line" style={{ fontWeight: 700, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && !allChecked;
                  }}
                  onChange={(e) => setSelected(e.target.checked ? new Set(people.map((p) => p.id)) : new Set())}
                />
                Select all {people.length} profiles
              </label>
              <p className="muted" style={{ margin: 0 }}>
                {selected.size} staff selected × {formatMoney(bulkAmount)} = {formatMoney(selected.size * bulkAmount)} total allocation
              </p>
            </div>
            <div className="actions">
              <button className="btn" type="button" disabled={!selected.size || busy === "bulk"} onClick={creditBulk}>
                {busy === "bulk" ? "Crediting…" : "Credit selected staff"}
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">No staff profiles found.</p>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Staff Weekly Ticket allocation</h2>
            <p className="muted">Use the checkboxes for bulk allocation, or credit an individual staff member. Allowed range: ₦2,000–₦5,000 in ₦500 steps.</p>
          </div>
        </div>
        {people.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>SELECT</th>
                  <th>STAFF</th>
                  <th>ROLE</th>
                  <th>WEEKLY TICKET</th>
                  <th>PERSONAL WALLET</th>
                  <th>ALLOCATION</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.fullName}`} style={{ width: "auto" }} />
                    </td>
                    <td>
                      <strong>{p.fullName}</strong>
                      <br />
                      <span className="muted">{p.email}</span>
                    </td>
                    <td>
                      <span className="tag">{p.role}</span>
                    </td>
                    <td>
                      <strong>{formatMoney(p.weeklyTicketKobo)}</strong>
                    </td>
                    <td>{formatMoney(p.walletKobo)}</td>
                    <td>
                      <select
                        aria-label={`Weekly Ticket amount for ${p.fullName}`}
                        value={rowAmount[p.id] ?? WEEKLY_TICKET_OPTIONS_KOBO[0]}
                        onChange={(e) => setRowAmount((r) => ({ ...r, [p.id]: Number(e.target.value) }))}
                        style={{ minWidth: 110, padding: 9, border: "1px solid #d8dde3", borderRadius: 8 }}
                      >
                        {amountOptions}
                      </select>
                    </td>
                    <td>
                      <button className="btn" type="button" disabled={busy === `credit-${p.id}`} onClick={() => creditOne(p)}>
                        {busy === `credit-${p.id}` ? "Crediting…" : "Credit Weekly Ticket"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No staff profiles found.</p>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function Maintenance({ o, act, busy }: { o: AdminOverview; act: Act; busy: string | null }) {
  const [confirmation, setConfirmation] = useState("");

  function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const userId = String(f.get("user_id") || "") || null;
    const weekly = f.get("weekly") === "on";
    const wallet = f.get("wallet") === "on";
    if (!weekly && !wallet) return void act("noop", async () => {}, "Select at least one balance to reset");
    const what = [weekly && "Weekly Ticket", wallet && "Personal Wallet"].filter(Boolean).join(", ");
    if (!confirm(`Reset ${what} for ${userId ? "the selected staff account" : "ALL staff accounts"}? This changes current balances immediately.`)) return;
    act("reset", () => apiSend("/api/admin/maintenance", "POST", { action: "reset_balances", userId, weekly, wallet }), (r) => `${(r as { changed: number }).changed} account(s) updated`);
  }

  function clearOrders() {
    if (!confirm("Clear ALL staff and guest order history? This cannot be undone.")) return;
    const typed = prompt("Type CLEAR ORDERS to confirm:");
    if (typed === null) return;
    act("clear-orders", () => apiSend("/api/admin/maintenance", "POST", { action: "clear_orders", confirmation: typed }), "Order history cleared");
  }

  function clearTransactions() {
    if (!confirm("Clear ALL financial transaction history? Current balances will not change.")) return;
    const typed = prompt("Type CLEAR TRANSACTIONS to confirm:");
    if (typed === null) return;
    act("clear-tx", () => apiSend("/api/admin/maintenance", "POST", { action: "clear_transactions", confirmation: typed }), (r) => `${(r as { cleared: number }).cleared} transaction record(s) cleared`);
  }

  function clearTestData(e: FormEvent) {
    e.preventDefault();
    if (confirmation !== "CLEAR TEST DATA") return void act("noop", async () => {}, "Type CLEAR TEST DATA exactly");
    if (!confirm("Final warning: clear all current TEST orders, transactions, wallet requests, reviews and chat, and reset staff Weekly Ticket? Personal Wallet will be preserved.")) return;
    act("clear-test", () => apiSend("/api/admin/maintenance", "POST", { action: "clear_test_data", confirmation }), "Test data cleared successfully").then(
      (ok) => ok && setConfirmation(""),
    );
  }

  return (
    <div className="panel" style={{ border: "2px solid #ead7d9" }}>
      <div className="panel-head">
        <div>
          <h2>System Maintenance</h2>
          <p className="muted">Admin-only controls for resetting balances and clearing test/history data. Destructive actions require confirmation and are recorded in the audit log.</p>
        </div>
      </div>
      <div className="columns" style={{ alignItems: "start" }}>
        <form className="panel" style={{ margin: 0 }} onSubmit={reset}>
          <h3>Reset Staff Balances</h3>
          <label className="field">
            Account
            <select name="user_id" defaultValue="">
              <option value="">All staff accounts</option>
              {o.directory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} — {cap(p.role)} · {p.email}
                </option>
              ))}
            </select>
          </label>
          <label className="check-line">
            <input type="checkbox" name="weekly" defaultChecked /> Weekly Ticket
          </label>
          <label className="check-line">
            <input type="checkbox" name="wallet" /> Personal Wallet
          </label>
          <button className="btn secondary" type="submit" disabled={busy === "reset"}>
            {busy === "reset" ? "Resetting…" : "Reset selected balances"}
          </button>
        </form>
        <div className="panel" style={{ margin: 0 }}>
          <h3>Clear Histories</h3>
          {o.maintenanceEnabled ? (
            <>
              <p className="muted">These actions do not reset current balances.</p>
              <div className="actions" style={{ marginTop: 14 }}>
                <button className="btn secondary" type="button" disabled={busy === "clear-orders"} onClick={clearOrders}>
                  Clear Order History
                </button>
                <button className="btn secondary" type="button" disabled={busy === "clear-tx"} onClick={clearTransactions}>
                  Clear Transaction History
                </button>
              </div>
            </>
          ) : (
            <p className="muted">History tools are switched off on this server, so real orders and transactions can&apos;t be deleted.</p>
          )}
        </div>
      </div>
      {o.maintenanceEnabled ? (
        <form className="panel" style={{ marginTop: 18 }} onSubmit={clearTestData}>
          <h3>Clear Test Data</h3>
          <p className="muted">
            Clears orders, guest orders, transactions, wallet requests, reviews and chat. Staff accounts, menu, Today&apos;s Special and bank settings are preserved. Personal
            Wallet is preserved by default.
          </p>
          <label className="field" style={{ maxWidth: 420 }}>
            <span>
              Type <b>CLEAR TEST DATA</b> to continue
            </span>
            <input name="confirmation" autoComplete="off" placeholder="CLEAR TEST DATA" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </label>
          <div className="actions">
            <button className="btn secondary" type="submit" disabled={busy === "clear-test"}>
              {busy === "clear-test" ? "Clearing…" : "Clear Test Data"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
