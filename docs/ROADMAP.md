# Roadmap

Blocks are marked ✅ DONE with the date and what shipped.

## Block 1 — Database and business rules ✅ DONE (31 Oct 2026)
PostgreSQL 17 locally; Prisma schema (users, menu, orders with split amounts,
top-ups, ledger, guest orders, reviews, chat, expiries, audit log, sessions);
services for ordering, wallet, Weekly Ticket, guest orders, chat, reviews,
staff, maintenance; seed from the live site.

## Block 2 — Sign-in ✅ DONE (31 Oct 2026)
Own magic-link sign-in (15-minute one-time links, hashed tokens, httpOnly
sessions), destination carried in the link, rate limits, Mailpit locally.

## Block 3 — API ✅ DONE (31 Oct 2026)
Role-checked, Zod-validated route handlers with `{ ok }` responses and a
cross-site request guard; menu photo upload and serving.

## Block 4 — Screens ✅ DONE (31 Oct 2026)
All staff, guest, Operator and Admin screens rebuilt with the v63 design;
live updates by polling; layout fixes; manifest and icons.

## Block 5 — Quality gate ✅ DONE (31 Oct 2026)
Typecheck, lint, production build; 34 unit + database tests (including a
race test: three orders against one balance → exactly one succeeds); manual
end-to-end pass in Chrome as Staff, Guest, Operator and Admin at desktop,
768 px and 390 px.

## Next (not started)
* **Deploy to the DigitalOcean droplet** — see `docs/DEPLOYMENT.md`.
* **Real SMTP provider** for sign-in emails in production.
* **Operator accounts** for the canteen team (Admin → Staff Management).
* **Data clean-up before launch:** Plantain price (₦50), "Ofada rice and egg"
  vs "Ofada rice & stew" naming, the duplicate "Joseph Adeyeye" entries.
* **Spec gaps** from the v63 Technical Project Guide — see
  `docs/SPEC_GAP_CHECK.md` (DB CHECK constraints, CSP header, sign-in audit,
  audit-log viewer, exports, and the decisions in its last section).
* Optional: let Admins edit the bank account shown for top-ups (currently set
  in the database / seed only).
