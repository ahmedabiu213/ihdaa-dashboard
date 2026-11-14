import type { Channel } from "@/lib/channels";

/**
 * One naming scheme for every ad link, so donations join to spend by ID:
 *   utm_source   = platform (fixed)
 *   utm_medium   = paid_social | cpc | message | email
 *   utm_campaign = campaign ID, filled by the platform's macro
 *   utm_content  = ad ID, filled by the platform's macro
 *   utm_term     = project code (p-<Salla product id> or a short code)
 *
 * Macros (verify in each Ads Manager's link preview):
 *   Snapchat {{campaign.id}} / {{ad.id}}   TikTok __CAMPAIGN_ID__ / __CID__
 *   Meta {{campaign.id}} / {{ad.id}}        Google {campaignid} / {creative}
 */
export type UtmPreset = {
  channel: Channel;
  medium: string;
  campaign: string | null; // null = typed by the user (no macros on that channel)
  content: string | null;
  paramsField?: string; // where to paste the parameters-only string, when the platform has one
  note?: string;
};

export const UTM_PRESETS: Record<string, UtmPreset> = {
  snapchat: { channel: "snapchat", medium: "paid_social", campaign: "{{campaign.id}}", content: "{{ad.id}}",
    note: "الصق الرابط الكامل في Website URL للإعلان. سناب شات يستبدل {{…}} بالمعرّفات عند النقر." },
  tiktok: { channel: "tiktok", medium: "paid_social", campaign: "__CAMPAIGN_ID__", content: "__CID__",
    paramsField: "URL parameters", note: "يمكن لصق المعاملات فقط في خانة URL parameters (بدون ?)." },
  instagram: { channel: "instagram", medium: "paid_social", campaign: "{{campaign.id}}", content: "{{ad.id}}",
    paramsField: "URL parameters", note: "في ميتا: خانة URL parameters على مستوى الإعلان." },
  facebook: { channel: "facebook", medium: "paid_social", campaign: "{{campaign.id}}", content: "{{ad.id}}",
    paramsField: "URL parameters", note: "في ميتا: خانة URL parameters على مستوى الإعلان." },
  google: { channel: "google", medium: "cpc", campaign: "{campaignid}", content: "{creative}",
    paramsField: "Final URL suffix", note: "الأفضل لصق المعاملات في Final URL suffix على مستوى الحساب أو الحملة. أبقِ Auto-tagging مفعلًا." },
  whatsapp: { channel: "whatsapp", medium: "message", campaign: null, content: null,
    note: "لرسائل واتساب: اكتب اسم الحملة يدويًا بحروف إنجليزية مختصرة (مثال: ramadan-1)." },
  sms: { channel: "sms", medium: "message", campaign: null, content: null },
  email: { channel: "email", medium: "email", campaign: null, content: null },
};

export type UtmInput = {
  platform: keyof typeof UTM_PRESETS;
  url: string;
  term: string;
  campaign?: string;
  content?: string;
};

/** Short, URL-safe code from free text: lowercase latin letters, digits and dashes. */
export function toCode(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Query string with macros left un-encoded (platforms must see the braces/underscores literally). */
export function utmParams(input: UtmInput): string {
  const p = UTM_PRESETS[input.platform];
  const pairs: Array<[string, string, boolean]> = [
    ["utm_source", p.channel, false],
    ["utm_medium", p.medium, false],
    ["utm_campaign", p.campaign ?? toCode(input.campaign ?? ""), !!p.campaign],
    ["utm_content", p.content ?? toCode(input.content ?? ""), !!p.content],
    ["utm_term", toCode(input.term), false],
  ];
  return pairs
    .filter(([, v]) => v)
    .map(([k, v, isMacro]) => `${k}=${isMacro ? v : encodeURIComponent(v)}`)
    .join("&");
}

export function buildUtmUrl(input: UtmInput): string {
  const url = new URL(input.url.trim());
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) url.searchParams.delete(k);
  const base = url.toString();
  const sep = url.search ? "&" : "?";
  return `${base}${sep}${utmParams(input)}`;
}
