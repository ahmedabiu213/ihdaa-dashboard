-- Resolve each attribution to a campaign and ad, whatever shape the platform's
-- auto-tagging used: IDs (utm_id / utm_campaign / utm_content), names, or only an ad.
-- security_invoker keeps the base tables' RLS in force for API roles.
CREATE VIEW "attribution_resolved" WITH (security_invoker = true) AS
WITH base AS (
  SELECT a.*,
    (SELECT e.external_id FROM ad_entities e
      WHERE e.platform = a.channel AND e.level = 'ad'
        AND (e.external_id = a.utm_content OR lower(btrim(e.name)) = lower(btrim(a.utm_content)))
      ORDER BY (e.external_id = a.utm_content) DESC, e.updated_at DESC LIMIT 1) AS matched_ad
  FROM attributions a
)
SELECT b.*,
  coalesce(
    (SELECT e.external_id FROM ad_entities e
      WHERE e.platform = b.channel AND e.level = 'campaign' AND e.external_id IN (b.utm_id, b.utm_campaign) LIMIT 1),
    (SELECT e.external_id FROM ad_entities e
      WHERE e.platform = b.channel AND e.level = 'campaign' AND lower(btrim(e.name)) = lower(btrim(b.utm_campaign))
      ORDER BY e.updated_at DESC LIMIT 1),
    (SELECT s.parent_external_id FROM ad_entities ad
      JOIN ad_entities s ON s.platform = ad.platform AND s.level = 'adset' AND s.external_id = ad.parent_external_id
      WHERE ad.platform = b.channel AND ad.level = 'ad' AND ad.external_id = b.matched_ad LIMIT 1),
    nullif(coalesce(nullif(b.utm_id, ''), b.utm_campaign), '')
  ) AS campaign_key,
  coalesce(b.matched_ad, nullif(b.utm_content, '')) AS ad_key
FROM base b;
