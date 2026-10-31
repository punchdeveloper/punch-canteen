# Deployment notes (DigitalOcean droplet) — not done yet

Notes for when the app moves to the droplet. Nothing here has been set up.

## What the app needs

* **Node 24** to run `npm run build` and `node .next/standalone/server.js`
  (the build uses `output: "standalone"`; copy `.next/static` and `public`
  next to it).
* **PostgreSQL 17** on the droplet (or a managed instance). Run
  `npx prisma migrate deploy` on each release, `npm run db:seed` once.
* **A persistent folder for menu photos** — `STORAGE_DIR` (e.g.
  `/srv/punch-canteen/storage`). Back it up with the database.
* **SMTP** for sign-in emails (`SMTP_*`, `MAIL_FROM`); set `APP_URL` to the
  public https address so links in emails are correct.
* `ENABLE_MAINTENANCE_TOOLS=false` in production.
* A reverse proxy with HTTPS (Caddy, Nginx or Traefik). The app reads the
  client IP from `X-Forwarded-For` for rate limits and the audit log.
* At least a **2 GB** droplet (Next.js + Postgres).

## Scheduled job: month-end Weekly Ticket expiry

Replaces v63's pg_cron job. Run a few minutes after midnight Lagos time on the
1st (Lagos is UTC+1 all year, so 23:05 UTC on the last day of the month):

```cron
5 23 28-31 * *  cd /srv/punch-canteen && [ "$(TZ=Africa/Lagos date +\%d)" = "01" ] && npm run job:expire-weekly-tickets >> /var/log/punch-canteen-expiry.log 2>&1
```

It is safe to run twice; each person is expired once per month.

## Backups

Nightly `pg_dump` of the database plus a copy of `STORAGE_DIR`, sent off the
droplet (e.g. DigitalOcean Spaces). Test a restore before go-live.

## Moving over from Supabase

No data migration is needed: the live data was test data. Seed the real menu,
staff directory and settings with `npm run db:seed`, then re-check prices
(Plantain is ₦50 on the live site). Staff sign in with magic links as before;
there are no passwords to move.
