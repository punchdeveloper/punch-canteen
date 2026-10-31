# PUNCH Canteen

Staff canteen app for PUNCH: today's menu, ordering paid from the company
**Weekly Ticket** and each person's **Personal Wallet**, digital food tickets,
guest orders by bank transfer, chat with the canteen, reviews, and two
back-office portals (**Canteen Operator** and **Canteen Admin**).

This is a full rebuild of the v63 single-file prototype
(`PUNCH-Canteen-v63-Staff-Review-Improvements`, Supabase) on
**Next.js 16 + TypeScript + PostgreSQL (Prisma 7)**. The look is unchanged;
the layout bugs, behaviour bugs and database security holes found in review
are fixed — see [docs/REBUILD_NOTES.md](docs/REBUILD_NOTES.md).

## Run it locally

Requirements: Node 24, PostgreSQL 17, an SMTP catcher (Laragon's Mailpit).

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # then fill in DATABASE_URL etc.
npx prisma migrate deploy   # create the tables
npm run db:seed             # real menu (with photos), staff directory, settings
npm run dev                 # http://localhost:3000
```

Sign in at `/login` with an email from the staff directory (e.g. an admin from
`prisma/seed.ts`). The link arrives in Mailpit at http://localhost:8025.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` · `npm run lint` · `npm test` | Quality gate. Tests need a separate `punch_canteen_test` database and a `.env.test` with its `DATABASE_URL`, `STORAGE_DIR="./storage-test"` and `ENABLE_MAINTENANCE_TOOLS="true"` |
| `npm run db:migrate` · `npm run db:seed` | Apply migrations · seed menu, staff and settings |
| `npx prisma migrate reset` | Wipe the local database and re-seed |
| `npm run job:expire-weekly-tickets` | Month-end Weekly Ticket expiry (run by cron in production) |

## Where things are

```
prisma/schema.prisma        database design (money in kobo, ledger, audit log)
prisma/seed.ts              real menu, staff directory, Today's Special, bank account
src/server/                 business rules: orders, wallet, guest orders, chat, staff…
src/server/ledger.ts        every balance change goes through here
src/app/api/                JSON API (Zod-validated, role-checked, { ok, … } responses)
src/app/**/page.tsx         pages (server-rendered first paint, then live polling)
src/components/views/       one component per screen
src/app/styles/v63.css      the v63 design, carried over (measured, unused rules removed)
src/app/styles/fixes.css    layout fixes on top of it
tests/                      unit + database integration tests
docs/                       rebuild notes, roadmap, deployment
```
