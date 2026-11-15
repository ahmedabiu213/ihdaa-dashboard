import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Conventions
 * - Money is numeric. Amounts the dashboard sums are always in SAR (`*_sar`).
 * - Calendar days are Riyadh days (`date` columns are already in Asia/Riyadh).
 * - `channel` is our normalized source: snapchat | tiktok | google | instagram |
 *   facebook | whatsapp | sms | email | direct | organic | referral | other.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────────────────── Store (Salla) ───────────────────────── */

/** Donation projects = Salla products. */
export const products = pgTable("products", {
  id: bigint("id", { mode: "number" }).primaryKey(), // Salla product id
  name: text("name").notNull(),
  slug: text("slug"),
  url: text("url"),
  price: numeric("price", { precision: 12, scale: 2 }),
  status: text("status"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Donations = Salla orders. Only `counts_as_revenue` orders are summed.
 *
 * An order can arrive from several sources (see `source`). Salla's own data
 * (Make.com, a Partners-app webhook, or an export upload) is `verified` and
 * always wins over what the storefront script reported.
 */
export const orders = pgTable(
  "orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sallaId: bigint("salla_id", { mode: "number" }), // Salla internal order id, when known
    referenceId: text("reference_id"), // the order number donors see
    status: text("status"), // Salla status slug
    countsAsRevenue: boolean("counts_as_revenue").notNull().default(false),
    totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("SAR"),
    paymentMethod: text("payment_method"),
    source: text("source").notNull(), // browser | make | salla_webhook | import
    verified: boolean("verified").notNull().default(false),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
    orderedDate: date("ordered_date").notNull(), // Riyadh day of orderedAt
    raw: jsonb("raw"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_ordered_date_idx").on(t.orderedDate),
    uniqueIndex("orders_salla_id_idx").on(t.sallaId),
    uniqueIndex("orders_reference_idx").on(t.referenceId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: bigint("order_id", { mode: "number" })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" }),
    name: text("name").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").notNull().default(1),
    totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)],
);

/* ───────────────────────── Tracking (browser) ───────────────────────── */

/** One row per page view reported by the storefront script. */
export const visits = pgTable(
  "visits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id").notNull(),
    path: text("path").notNull(),
    title: text("title"),
    referrer: text("referrer"),
    channel: text("channel").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    utmId: text("utm_id"), // campaign ID when the platform puts the name in utm_campaign (TikTok)
    uaApp: text("ua_app"), // in-app browser detected from the User-Agent (snapchat, tiktok, …)
    query: text("query"), // landing query string, kept to diagnose untagged traffic
    clickIdType: text("click_id_type"), // sccid | ttclid | gclid | fbclid
    clickId: text("click_id"),
    visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
    visitedDate: date("visited_date").notNull(),
  },
  (t) => [
    index("visits_date_idx").on(t.visitedDate),
    index("visits_session_idx").on(t.sessionId),
    index("visits_path_idx").on(t.path),
  ],
);

/**
 * The attribution the browser reports at purchase time. It holds no money:
 * it is joined to `orders` by order id / reference, so a forged report adds nothing.
 */
export const attributions = pgTable(
  "attributions",
  {
    orderRef: text("order_ref").primaryKey(), // id or reference reported by the browser
    orderId: bigint("order_id", { mode: "number" }).references(() => orders.id, {
      onDelete: "set null",
    }),
    visitorId: text("visitor_id"),
    sessionId: text("session_id"),
    channel: text("channel").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    utmId: text("utm_id"), // campaign ID when the platform puts the name in utm_campaign (TikTok)
    uaApp: text("ua_app"),
    clickIdType: text("click_id_type"),
    clickId: text("click_id"),
    landingPath: text("landing_path"),
    touchedAt: timestamp("touched_at", { withTimezone: true }), // when that ad click happened
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("attributions_order_id_idx").on(t.orderId)],
);

/* ───────────────────────── Ad platforms ───────────────────────── */

export const adAccounts = pgTable(
  "ad_accounts",
  {
    id: serial("id").primaryKey(),
    platform: text("platform").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name"),
    currency: text("currency"),
    timezone: text("timezone"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ad_accounts_platform_ext_idx").on(t.platform, t.externalId)],
);

/** Campaigns, ad sets/squads/groups and ads, with their current names. */
export const adEntities = pgTable(
  "ad_entities",
  {
    platform: text("platform").notNull(),
    level: text("level").notNull(), // campaign | adset | ad
    externalId: text("external_id").notNull(),
    parentExternalId: text("parent_external_id"),
    accountExternalId: text("account_external_id"),
    name: text("name"),
    status: text("status"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.platform, t.level, t.externalId] })],
);

/**
 * Daily spend at the finest level the source gives. Missing levels are ''
 * (not NULL) so the unique key works for upserts.
 */
export const spendDaily = pgTable(
  "spend_daily",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    date: date("date").notNull(),
    platform: text("platform").notNull(),
    accountExternalId: text("account_external_id").notNull().default(""),
    campaignId: text("campaign_id").notNull().default(""),
    adsetId: text("adset_id").notNull().default(""),
    adId: text("ad_id").notNull().default(""),
    spend: numeric("spend", { precision: 14, scale: 4 }).notNull().default("0"),
    currency: text("currency").notNull().default("SAR"),
    spendSar: numeric("spend_sar", { precision: 14, scale: 2 }).notNull().default("0"),
    impressions: bigint("impressions", { mode: "number" }).notNull().default(0),
    clicks: bigint("clicks", { mode: "number" }).notNull().default(0),
    platformConversions: numeric("platform_conversions", { precision: 14, scale: 2 }),
    platformConversionValueSar: numeric("platform_conversion_value_sar", { precision: 14, scale: 2 }),
    source: text("source").notNull(), // api | script | csv | manual
    note: text("note"),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("spend_daily_grain_idx").on(t.platform, t.date, t.accountExternalId, t.campaignId, t.adsetId, t.adId),
    index("spend_daily_date_idx").on(t.date),
  ],
);

/* ───────────────────────── Tools & plumbing ───────────────────────── */

export const utmLinks = pgTable("utm_links", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  productId: bigint("product_id", { mode: "number" }),
  label: text("label"),
  url: text("url").notNull(),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

/** OAuth tokens and connection state per platform. Tokens are AES-GCM encrypted. */
export const integrations = pgTable("integrations", {
  platform: text("platform").primaryKey(),
  status: text("status").notNull().default("disconnected"), // connected | error | disconnected
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  meta: jsonb("meta").default(sql`'{}'::jsonb`),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: updatedAt(),
});

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    platform: text("platform").notNull(),
    status: text("status").notNull(), // running | ok | error
    rows: integer("rows").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("sync_runs_platform_idx").on(t.platform, t.startedAt)],
);

/** Raw webhook bodies, kept for replay and debugging. */
export const webhookEvents = pgTable("webhook_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  source: text("source").notNull(),
  event: text("event"),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
