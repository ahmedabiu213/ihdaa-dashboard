# Go-live checklist

Everything in the code is done. These are the steps outside the code, in order.
Database tables and the hourly sync schedule already exist in the Supabase project
**ihdad marketing dashboard**.

## 1. Vercel: create the project (10 min)

1. vercel.com → **Add New → Project** → import `ahmedabiu213/ihdaa-dashboard`.
2. Keep the project name **ihdaa-dashboard** (the Snapchat/TikTok redirect URLs use `ihdaa-dashboard.vercel.app`).
3. **Environment Variables**: paste all of the variables below, then **Deploy**.

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Supabase → **Connect** → **Transaction pooler** (port 6543), with the database password in place of `[YOUR-PASSWORD]` (no brackets). If the password has `@ # / ? % :`, reset it in Supabase to letters and digits only |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfhywnikwrjstckldyb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_Z_bPlk-JcHvYFypAl7wwnQ_teqA_Nfn` |
| `NEXT_PUBLIC_APP_URL` | `https://ihdaa-dashboard.vercel.app` |
| `NEXT_PUBLIC_STORE_URL` | `https://store-ihdaa.org.sa/ar` |
| `STORE_ORIGINS` | `https://store-ihdaa.org.sa` |
| `TOKEN_ENCRYPTION_KEY` | Generated for you (see the secrets file) |
| `CRON_SECRET` | Generated for you. **Must stay exactly this value**: the hourly sync in Supabase uses it |
| `ORDERS_INGEST_SECRET` | Generated for you |
| `GOOGLE_ADS_INGEST_SECRET` | Generated for you |
| `SNAPCHAT_CLIENT_ID` | Snap Business Manager → Business Details → OAuth Apps |
| `SNAPCHAT_CLIENT_SECRET` | Same page. **Regenerate it first** (the old one was shared in chat) |
| `SNAPCHAT_AD_ACCOUNT_ID` | Snapchat Ads Manager, account ID |
| `TIKTOK_APP_ID` | TikTok for Business → My Apps → your app |
| `TIKTOK_APP_SECRET` | Same page |
| `USD_TO_SAR` | `3.75` |
| `TIKTOK_ADVERTISER_ID` | Optional: only if you authorize several TikTok ad accounts |

Adding or changing a variable later needs **Deployments → Redeploy**.

## 2. Check the deployment (2 min)

1. Open `https://ihdaa-dashboard.vercel.app` and log in (`admin@ihdaa.local` or a user you added in
   Supabase → Authentication → Users → Add user, with **Auto Confirm User**).
2. Go to **الربط والمزامنة**. The **فحص الإعدادات** card must show every required variable green.
3. Change the admin password: sidebar → **حسابي**.
4. Supabase → Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".

## 3. Connect the ad platforms (10 min)

- **Snapchat**: in the Snap OAuth app set the redirect URL to
  `https://ihdaa-dashboard.vercel.app/api/oauth/snapchat/callback`, then click **ربط سناب شات**.
- **TikTok**: click **ربط تيك توك** (the redirect URL is already registered).
- **Google Ads**: copy the script from the Google card into Google Ads → Tools → Bulk actions → Scripts,
  authorize, run once with `DAYS = 90`, set `DAYS = 7`, schedule **Hourly**.
- **Meta (Instagram / Facebook / WhatsApp ads)**: no API yet. Enter spend on **الإنفاق اليدوي**
  (by hand, or upload the Ads Manager export as CSV and choose the platform).

After each connection the card shows the last sync and any error text from the platform.

## 4. Store tracking with Google Tag Manager (new account, ~20 min)

The tracker needs the dashboard to be deployed first (it is served from `ihdaa-dashboard.vercel.app/t.js`).

**A. Create the Tag Manager container**
1. Go to tagmanager.google.com with the Google account the organization will own → **Create Account**.
2. Account name: `Ihdaa`, country: Saudi Arabia. Container name: `store-ihdaa.org.sa`, target platform: **Web** → Create, accept the terms.
3. Copy the container ID at the top (`GTM-XXXXXXX`). Close the "Install Google Tag Manager" code window: Salla installs it for you.

**B. Connect it to Salla**
1. In the Salla dashboard, search for **Google Tag Manager** (it is listed with the store's marketing/service integrations).
2. Paste the `GTM-XXXXXXX` ID and save. Salla now loads the container on every store page.

**C. Add the dashboard tracker**
1. Tag Manager → **Tags → New → Tag Configuration → Custom HTML**, paste:
   `<script src="https://ihdaa-dashboard.vercel.app/t.js" async></script>`
2. **Triggering → All Pages**. Name it `Ihdaa dashboard tracker` → **Save**.
3. **Submit → Publish**. Nothing runs until the container is published.

**D. Test**
1. In Tag Manager click **Preview**, enter `https://store-ihdaa.org.sa/ar` and check that "Ihdaa dashboard tracker" fired.
2. Open the store with `?ihd_debug=1` (or one of your TikTok/Snapchat ad links with `&ihd_debug=1`),
   press F12 → Console: `[ihdaa] loaded` and `[ihdaa] touch saved` appear.
3. Make a 1 SAR donation. The thank-you page should log `[ihdaa] purchase … delivered`.
   Within a minute it appears in **التبرعات** with its channel, and visits appear on the overview.
4. If no purchase line appears, send the console output: debug mode prints every event the store sends.

Existing TikTok and Snapchat ads need no changes: their own auto-added UTMs and click IDs are captured
as-is and matched to campaigns by ID or name. Use **روابط UTM** for WhatsApp/SMS links.
Keep the Snapchat/TikTok pixels you already connected in Salla; they are separate from this tracker.

## 5. Verified orders from Salla (choose one)

- **Make.com** (near real time): follow the steps in the **طلبات سلة عبر Make.com** card.
- **Daily CSV** (free): Salla → Orders → Export → save as CSV UTF-8 → **التبرعات → استيراد طلبات سلة**.
- **Salla Partners app** (if approved): webhook URL `https://ihdaa-dashboard.vercel.app/api/webhooks/salla`,
  and put the app's webhook secret in `SALLA_WEBHOOK_SECRET`.

Without any of these the dashboard still counts donations reported by the store script, marked
"from store script only".

## How syncing runs

- Snapchat and TikTok: every hour at minute 7 (Supabase pg_cron → `/api/cron/sync`), plus once a day from Vercel.
- Google Ads: every hour from the Google Ads Script.
- A manual **مزامنة الآن** button on each card.
