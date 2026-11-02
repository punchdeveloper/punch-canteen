# Spec gap check — rebuild vs. the v63 Technical Project Guide

Checked 31 Oct 2026 against
`PUNCH_Canteen_Hub_Complete_Technical_Project_Guide_v63.md` (180 capabilities,
known risks, acceptance tests, open decisions). Each item was checked against
the code in this repo, not assumed.

**Key:** ✅ done · 🟡 partly done · ❌ not built · ⏸ needs a decision first ·
n/a no longer applies (Supabase removed)

## Summary

| Guide status | Items | ✅ (or n/a) | 🟡 | ⏸ | ❌ |
| --- | --- | --- | --- | --- | --- |
| CODE (in v63) | 87 | 87 | 0 | 0 | 0 |
| PARTIAL (half-built in v63) | 24 | 17 | 3 | 1 | 3 |
| VERIFY (live DB unknown) | 10 | 8 (2 n/a) | 2 | 0 | 0 |
| PROPOSED (future / planned) | 59 | 3 | 10 | 7 | 39 |
| **Total** | **180** | **115** | **15** | **8** | **42** |

Everything v63 actually did is covered. The open work is the PROPOSED list
plus a few half-done items (marked 🟡 below).

## 01 Identity and sign-in

| ID | Status | Rebuild |
| --- | --- | --- |
| AUTH-001 | ✅ | Own magic-link sign-in (15-min one-time links, hashed) |
| AUTH-002 | ✅ | Staff directory = `users` table; only listed emails get a link |
| AUTH-003 | ✅ | httpOnly cookie session, restored server-side |
| AUTH-004 | ✅ | Role/balances read from the DB on every request |
| AUTH-005 | ✅ | Server-side portal guards + access-denied page |
| AUTH-006 | ✅ | Destination stored on the link; tested from both portals |
| AUTH-007 | ✅ | One magic-link method for every role |
| AUTH-008 | ✅ | Resend link on the check-email page |
| AUTH-009 | ✅ | Sign-out deletes the session |
| AUTH-010 | ✅ | Suspend/deactivate signs the person out everywhere; no new link |
| AUTH-011 | ✅ | Master admin protected on the server (tested) |
| AUTH-012 | ✅ | Every API checks role + status; spot-tested by direct requests |
| AUTH-013 | ✅ | Unregistered emails never get an account or a link |
| AUTH-014 | ❌ | SSO / MFA not built |
| AUTH-015 | 🟡 | Mailpit locally; real SMTP provider still to set up |
| AUTH-016 | 🟡 | Admin/Operator actions audited; sign-ins and failed sign-ins not logged |

## 02 Navigation and interface

| ID | Status | Rebuild |
| --- | --- | --- |
| UI-001–005 | ✅ | Public Home/Menu, greeting with Lagos date/time, Today's Special, branding, nav |
| UI-006 | ✅ | Phone/tablet bottom nav fixed; checked at 390 and 768 px |
| UI-007 | ✅ | Portal button only for Operator/Admin |
| UI-008 | ✅ | Logo + Back to Home on sign-in screens |
| UI-009 | ✅ | Real URLs; refresh keeps the page and its data |
| UI-010 | ✅ | Pages render with data on first paint (no boot overlay needed) |
| UI-011–013 | ✅ | Responsive forms, cart/header alignment fixed, cart + unread badges |
| UI-014 | ❌ | No formal WCAG 2.2 audit (reduced-motion is honoured) |

## 03 Menu

| ID | Status | Rebuild |
| --- | --- | --- |
| MENU-001–002 | ✅ | Live menu, cards with photo, price, category, allergen note |
| MENU-003 | ✅ | All / Meals / Drinks filter, same as v63 (blueprint's Rice/Protein/Swallow… not built) |
| MENU-004 | ❌ | No meal search (v63 had none either) |
| MENU-005–009 | ✅ | Create, edit, availability, photo upload (checked by content, ≤5 MB), Today's Special |
| MENU-010 | ✅ | Server re-prices and re-checks availability at checkout |
| MENU-011 | ⏸ | Ordering hours not enforced; needs the 11:00–17:00 decision |
| MENU-012–014 | ❌ | Meal combos, verified allergen/nutrition data, stock counts |

## 04 Cart, ordering, tickets

| ID | Status | Rebuild |
| --- | --- | --- |
| ORDER-001–005 | ✅ | Cart, totals, balance preflight, shortfall + Top up link, one-transaction checkout |
| ORDER-006 | ✅ | Row locks; race test: 3 orders vs 1 balance → exactly 1 succeeds |
| ORDER-007 | ✅ | History with Weekly Ticket / Wallet split stored on the order |
| ORDER-008–010 | ✅ | Received → Ready (→ Collected, added in review round 2), ticket shown |
| ORDER-011 | 🟡 | Operator marks Collected → ticket shows USED; no QR scan |
| ORDER-012 | ✅ | v63's local-only "Remove order" dropped; history always comes from the DB |
| ORDER-013 | ⏸ | No cancellation/refund; needs the refund decision |
| ORDER-014–015 | ❌ | Ready push alerts, pickup slots |

## 05 Weekly Ticket and wallet

| ID | Status | Rebuild |
| --- | --- | --- |
| FIN-001–011 | ✅ | Both balances, Weekly Ticket first, no debt (tested), ₦2,000–₦5,000 credits single + bulk, bank details, top-up request/confirm/reject with reason, history, expiry |
| FIN-012 | 🟡 | Expiry job written + tested; cron gets installed on the droplet |
| FIN-013 | ✅ | Expiry never touches the wallet (tested) |
| FIN-014 | ✅ | Ledger with balance-after on every entry; ledger = balance checked in tests |
| FIN-015 | ❌ | Paystack/Flutterwave |
| FIN-016–017 | ⏸ | Automatic weekly credits / eligibility rules need a policy decision |

## 06 Guest orders

| ID | Status | Rebuild |
| --- | --- | --- |
| GUEST-001–007 | ✅ | Browse, checkout, reference, lookup, Operator confirm/reject, kitchen status |
| GUEST-008 | ✅ | Kitchen queue only shows payment-confirmed guest orders (server-side) |
| GUEST-009 | ❌ | No SMS/email receipt (guests give a phone number, no email) |

## 07 Chat

| ID | Status | Rebuild |
| --- | --- | --- |
| CHAT-001–005 | ✅ | Staff ↔ canteen chat, conversation list (newest first), replies, unread counts, Lagos times |
| CHAT-006 | ✅ | Staff can only post to / read their own conversation (server-scoped) |
| CHAT-007 | ❌ | Attachments, moderation |
| CHAT-008 | 🟡 | 5-second polling instead of realtime (fine at this size) |

## 08 Reviews and complaints

| ID | Status | Rebuild |
| --- | --- | --- |
| REV-001 | ✅ | Food reviews |
| REV-002 | ✅ | Purchased-only enforced on the server by menu item ID |
| REV-003–005 | ✅ | Experience reviews, admin feed, search, averages |
| REV-006 | ❌ | v63's demo "issues" dropped; no complaint workflow |
| REV-007–009 | ❌ | Structured complaints, anonymous channel, photo evidence |
| REV-010 | ✅ | Review linked to a real order of that person (repeat rule: see decisions) |
| REV-011–012 | ❌ | Extra score dimensions, moderation/escalation |

## 09 Operator portal

| ID | Status | Rebuild |
| --- | --- | --- |
| OPS-001–009 | ✅ | Portal, live orders, Ready/Collected, menu editor, top-ups, guest payments + kitchen, chat, tabs with counts |
| OPS-010 | ✅ | Queue refreshes every 5 s (tested) |
| OPS-011–012 | ❌ | Kitchen board, shifts/stock |
| OPS-013 | 🟡 | Ready/collected times are recorded; no waiting-time report yet |

## 10 Admin

| ID | Status | Rebuild |
| --- | --- | --- |
| ADM-001–016 | ✅ | All six sections; add/import/role/status/remove staff; balances; financial summary + search; reviews; credits; reset; clear tools (hidden unless `ENABLE_MAINTENANCE_TOOLS=true`) |
| ADM-017 | 🟡 | Clear tools run in one transaction, are audited and keep the audit log; backups not set up yet |
| ADM-018 | ⏸ | HR / Management roles need a decision |
| ADM-019 | ❌ | No CSV/JSON export (v63's only read local demo data) |
| ADM-020 | ❌ | Management scorecards |
| ADM-021 | 🟡 | `audit_logs` written for all money, staff, menu and maintenance actions; no screen to view it, not write-protected at DB level |

## 11 Install to phone (PWA)

| ID | Status | Rebuild |
| --- | --- | --- |
| PWA-001–003 | ✅ | Manifest + 192/512/maskable icons return 200; install banner |
| PWA-004 / 006 | ⏸ | No service worker (online only, like v63); offline menu needs a decision |
| PWA-005 | ✅ | Standalone manifest with name, colours, start URL |
| PWA-007 | 🟡 | Icons done; not install-tested on a real iPhone/Android |
| PWA-008–010 | ❌ | Push notifications, app stores, "new version" message |

## 12 Security and operations

| ID | Status | Rebuild |
| --- | --- | --- |
| SEC-001 / 003 | n/a | No Supabase RLS/RPCs; the browser never talks to the DB |
| SEC-002 | 🟡 | Cross-user and role checks tested by hand; no automated suite |
| SEC-004 | ✅ | Atomic debits, row locks, kobo integers, unique references, one-time top-up credit |
| SEC-005 | ✅ | Uploads Operator/Admin only, type checked by content, 5 MB |
| SEC-006 | 🟡 | React escaping, no inline handlers; no Content-Security-Policy header yet |
| SEC-007 | ✅ | No demo/local state left |
| SEC-008 | 🟡 | Backup plan in DEPLOYMENT.md; not set up |
| SEC-009 | ❌ | Monitoring/alerts |
| SEC-010 | 🟡 | README, REBUILD_NOTES, DEPLOYMENT, ROADMAP; no incident/onboarding runbook |
| SEC-011 | 🟡 | Typecheck, lint, 34 tests, build run locally; no CI pipeline |
| SEC-012 | ❌ | No automated browser tests (manual Chrome pass only) |
| SEC-013 | ⏸ | Privacy/retention policy needs a decision |
| SEC-014 | ❌ | Notification pipeline |
| SEC-015 | ✅ | Split into a Next.js app with migrations and env config |
| SEC-016 | 🟡 | Separate dev and test databases; no staging yet |

## 13 Future blueprint (FUT-001–015)

All ❌: QR collection, POS payment, favourites/reorder, advanced search,
nutrition, forecasting, inventory, complaint categorisation, AI summaries,
payroll, period reports, hygiene checklists, complaint SLAs, HR sync,
multi-location.

## Section 7 — known risks

| Risk | Status | Note |
| --- | --- | --- |
| RISK-01 RLS not verified | ✅ | Replaced by server-side checks |
| RISK-02 Money functions not audited | ✅ | Rewritten in `src/server/ledger.ts` + tests |
| RISK-03 Dangerous maintenance tools | ✅ | Off by env flag, typed confirmations, audited; "backup first" not enforced |
| RISK-04 Reviews only gated in browser | ✅ | Server-side by item ID |
| RISK-05 Incomplete PWA | 🟡 | Manifest + icons done; no service worker |
| RISK-06 Demo logic | ✅ | Removed |
| RISK-07 No paid end-to-end test | 🟡 | Done locally (top-up → order → debit → ready → collected); not on real devices |
| RISK-08 Phone/tablet not retested | 🟡 | Chrome at 390/768; no real Safari/Android test |
| RISK-09 Role routing only code-checked | ✅ | Tested in Chrome for all roles, suspended, direct URLs, refresh |
| RISK-10 Guest lookup privacy | ✅ | Minimal fields, rate limited |
| RISK-11 No audit log | ✅ | `audit_logs` (sign-ins not logged) |
| RISK-12 Single HTML file | ✅ | Replaced |
| RISK-13 Stale cart prices | ✅ | Server re-prices at checkout |
| RISK-14 Hard-coded bank details | ✅ | In `canteen_settings` |

## Section 8 — data constraints

The app enforces all of them in code, but the database itself has **no CHECK
constraints** (balances ≥ 0, price ≥ 0, quantity > 0, rating 1–5). One small
migration would add them as a second safety net. Not done yet.

## Section 9 — release-gate tests

Passed locally: AUTH-01–06, NAV-01–04, MENU-01–02, ORDER-01–07, GUEST-01–02,
REVIEW-01–02, SEC-01–02, FIN-01–03, PWA-01 (manifest/icons 200).
Not done: home-screen install launch on a real phone (PWA-01), PWA-02 (no
offline mode), OPS-01 (real Android + iPhone).

## Section 12 — decisions still needing sign-off

| Decision | What the rebuild does today |
| --- | --- |
| Weekly credits: manual, automatic or fixed policy | Manual (Admin credits) |
| Ordering outside 11:00–17:00, holidays | Allowed any time |
| Cancellation after payment / refunds | Not possible |
| Repeat reviews; only Ready/collected orders count | Repeats allowed; any non-cancelled order counts |
| Separate Management / HR role | Not built (staff / operator / admin) |
| Anonymous complaints | Not built |
| Destructive maintenance in production | Hidden unless the env flag is on |
| Offline menu in the installed app | Online only |
| Data retention periods | None set (keeps everything) |
