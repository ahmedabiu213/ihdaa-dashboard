CREATE TABLE "ad_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text,
	"currency" text,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_entities" (
	"platform" text NOT NULL,
	"level" text NOT NULL,
	"external_id" text NOT NULL,
	"parent_external_id" text,
	"account_external_id" text,
	"name" text,
	"status" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_entities_platform_level_external_id_pk" PRIMARY KEY("platform","level","external_id")
);
--> statement-breakpoint
CREATE TABLE "attributions" (
	"order_ref" text PRIMARY KEY NOT NULL,
	"order_id" bigint,
	"visitor_id" text,
	"session_id" text,
	"channel" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"click_id_type" text,
	"click_id" text,
	"landing_path" text,
	"touched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"platform" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"product_id" bigint,
	"name" text NOT NULL,
	"sku" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_sar" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"salla_id" bigint,
	"reference_id" text,
	"status" text,
	"counts_as_revenue" boolean DEFAULT false NOT NULL,
	"total_sar" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"payment_method" text,
	"source" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"ordered_at" timestamp with time zone NOT NULL,
	"ordered_date" date NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"url" text,
	"price" numeric(12, 2),
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_daily" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"platform" text NOT NULL,
	"account_external_id" text DEFAULT '' NOT NULL,
	"campaign_id" text DEFAULT '' NOT NULL,
	"adset_id" text DEFAULT '' NOT NULL,
	"ad_id" text DEFAULT '' NOT NULL,
	"spend" numeric(14, 4) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"spend_sar" numeric(14, 2) DEFAULT '0' NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"platform_conversions" numeric(14, 2),
	"platform_conversion_value_sar" numeric(14, 2),
	"source" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"status" text NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "utm_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"product_id" bigint,
	"label" text,
	"url" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"title" text,
	"referrer" text,
	"channel" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"click_id_type" text,
	"click_id" text,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visited_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event" text,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_accounts_platform_ext_idx" ON "ad_accounts" USING btree ("platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attributions_order_id_idx" ON "attributions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_ordered_date_idx" ON "orders" USING btree ("ordered_date");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_salla_id_idx" ON "orders" USING btree ("salla_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_idx" ON "orders" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spend_daily_grain_idx" ON "spend_daily" USING btree ("platform","date","account_external_id","campaign_id","adset_id","ad_id");--> statement-breakpoint
CREATE INDEX "spend_daily_date_idx" ON "spend_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "sync_runs_platform_idx" ON "sync_runs" USING btree ("platform","started_at");--> statement-breakpoint
CREATE INDEX "visits_date_idx" ON "visits" USING btree ("visited_date");--> statement-breakpoint
CREATE INDEX "visits_session_idx" ON "visits" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "visits_path_idx" ON "visits" USING btree ("path");