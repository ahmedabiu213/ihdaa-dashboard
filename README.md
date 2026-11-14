# Ihdaa marketing dashboard

Arabic, right-to-left dashboard that shows donations (from Salla), ad spend
(from each platform), and return on spend per channel, campaign and project.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 + shadcn/ui (RTL) ·
Recharts · Drizzle ORM · Supabase (Postgres + Auth) · Vercel.

## How the numbers work

- **Money only comes from Salla** (order webhook). The browser never reports amounts.
- **The storefront script only reports attribution** (UTMs, click IDs, landing page).
  A purchase report is linked to an order Salla confirmed; a forged one adds nothing.
- **Spend** comes from platform APIs (Snapchat first), the Google Ads Script, or CSV/manual entry.
- Days are **Asia/Riyadh**; amounts are **SAR**.

## Setup

1. Create a Supabase project. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`: Project Settings → Database → Connection string → **Transaction pooler** (port 6543).
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Project Settings → API.
2. Create the tables: `pnpm db:migrate`
3. In Supabase → Authentication: **turn off public sign-ups** and invite each team member.
4. `pnpm dev` and open http://localhost:3000

Without Supabase variables, local development skips login so the UI can be previewed.
In production the app refuses to serve pages until auth is configured.

## Snapchat

1. In Snap Business Manager → Business Details → OAuth Apps, set the redirect URL to
   `https://ihdaa-dashboard.vercel.app/api/oauth/snapchat/callback`.
2. In Vercel set `SNAPCHAT_CLIENT_ID`, `SNAPCHAT_CLIENT_SECRET`, `SNAPCHAT_AD_ACCOUNT_ID`, `TOKEN_ENCRYPTION_KEY`.
3. Dashboard → الربط والمزامنة → ربط سناب شات. The last 90 days are backfilled automatically.

Spend is pulled per ad per day (`/v1/adaccounts/{id}/stats?granularity=DAY&breakdown=ad`) and the
last 3 days are re-pulled on every run, because Snapchat keeps finalizing recent numbers.

**Schedule.** `vercel.json` runs `/api/cron/sync` (Snapchat and TikTok) once a day (the Vercel Hobby limit). For hourly
updates, schedule it from Supabase (Database → Extensions: enable `pg_cron` and `pg_net`):

```sql
select cron.schedule('ihdaa-sync', '7 * * * *', $$
  select net.http_get(
    url := 'https://ihdaa-dashboard.vercel.app/api/cron/sync',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
$$);
```

## TikTok

1. In the TikTok developer app, the advertiser redirect URL is
   `https://ihdaa-dashboard.vercel.app/api/oauth/tiktok/callback`.
2. In Vercel set `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` (and `TIKTOK_ADVERTISER_ID` if the
   authorization covers several advertiser accounts).
3. Dashboard → الربط والمزامنة → ربط تيك توك. The last 90 days are backfilled automatically.

Spend comes from `GET /open_api/v1.3/report/integrated/get/` (BASIC, AUCTION_AD, `ad_id` ×
`stat_time_day`), in week-sized windows. The advertiser token is long-lived; if it is revoked,
reconnect. TikTok's purchase metrics are requested too; if TikTok rejects them for this account,
the sync continues with spend, impressions and clicks only.

## UTM links

Every ad link uses one scheme (see `src/lib/utm.ts`): `utm_source` = platform,
`utm_campaign` = campaign ID macro, `utm_content` = ad ID macro, `utm_term` = project.
IDs, not names, so each donation joins to the exact spend row. Build links on the روابط UTM page.

`pnpm test` checks the link builder.

## Layout

```
src/app/(dashboard)/   pages (overview, channels, campaigns, projects, donations, utm, spend, settings)
src/app/login/         login page and actions
src/proxy.ts           login guard (Next 16 "proxy", formerly middleware)
src/db/schema.ts       database tables
src/lib/queries/       SQL for each page
src/lib/channels.ts    channel names, colors, and source → channel rules
drizzle/               SQL migrations (includes enabling RLS on every table)
```
