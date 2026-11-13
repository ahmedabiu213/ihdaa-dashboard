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
