-- Supabase exposes the public schema through its REST API using the public anon key.
-- Enabling RLS with no policies blocks that path completely. The app itself connects
-- directly as the database owner, which bypasses RLS.
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "visits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_entities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "spend_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "utm_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
