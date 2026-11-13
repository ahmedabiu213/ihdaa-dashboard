/**
 * Normalized traffic/donation channels with Arabic labels and chart colors.
 * Paid channels use a fixed, colorblind-validated categorical order; unpaid
 * channels share one neutral gray (they are labeled in every table).
 */
export const CHANNELS = {
  snapchat: { label: "سناب شات", color: "#eda100", paid: true },
  tiktok: { label: "تيك توك", color: "#e87ba4", paid: true },
  google: { label: "إعلانات قوقل", color: "#2a78d6", paid: true },
  instagram: { label: "انستقرام", color: "#eb6834", paid: true },
  facebook: { label: "فيسبوك", color: "#6250d6", paid: true },
  whatsapp: { label: "واتساب", color: "#008300", paid: true },
  sms: { label: "رسائل SMS", color: "#1baf7a", paid: false },
  email: { label: "البريد", color: "#9a9aa6", paid: false },
  organic: { label: "بحث طبيعي", color: "#9a9aa6", paid: false },
  referral: { label: "مواقع أخرى", color: "#9a9aa6", paid: false },
  direct: { label: "مباشر", color: "#9a9aa6", paid: false },
  other: { label: "أخرى", color: "#9a9aa6", paid: false },
  unknown: { label: "غير معروف", color: "#c4c4cc", paid: false },
} as const;

export type Channel = keyof typeof CHANNELS;
export const CHANNEL_KEYS = Object.keys(CHANNELS) as Channel[];
/** Platforms we can pull or upload spend for. */
export const SPEND_PLATFORMS = ["snapchat", "tiktok", "google", "instagram", "facebook", "whatsapp"] as const satisfies readonly Channel[];

export function isChannel(v: unknown): v is Channel {
  return typeof v === "string" && v in CHANNELS;
}

export function channelLabel(v: string | null | undefined) {
  return isChannel(v) ? CHANNELS[v].label : (v ?? CHANNELS.other.label);
}

const SOURCE_ALIASES: Record<string, Channel> = {
  snapchat: "snapchat", snap: "snapchat", sc: "snapchat",
  tiktok: "tiktok", tt: "tiktok",
  google: "google", adwords: "google", gads: "google",
  instagram: "instagram", ig: "instagram",
  facebook: "facebook", fb: "facebook", meta: "facebook",
  whatsapp: "whatsapp", wa: "whatsapp",
  sms: "sms", email: "email", newsletter: "email",
};

const SEARCH_REFERRERS = /(^|\.)(google|bing|yahoo|duckduckgo|yandex)\./i;
const SOCIAL_REFERRERS: Array<[RegExp, Channel]> = [
  [/snapchat\.com$/i, "snapchat"],
  [/tiktok\.com$/i, "tiktok"],
  [/instagram\.com$/i, "instagram"],
  [/(facebook\.com|fb\.com)$/i, "facebook"],
  [/(whatsapp\.com|wa\.me)$/i, "whatsapp"],
];

/**
 * Decide the channel for a visit. Order: utm_source, then ad click id,
 * then referrer, else direct.
 */
export function resolveChannel(input: {
  utmSource?: string | null;
  clickIdType?: string | null;
  referrer?: string | null;
  ownHost?: string | null;
}): Channel {
  const src = input.utmSource?.trim().toLowerCase();
  if (src) return SOURCE_ALIASES[src] ?? (isChannel(src) ? src : "other");
  switch (input.clickIdType) {
    case "sccid": return "snapchat";
    case "ttclid": return "tiktok";
    case "gclid": case "gbraid": case "wbraid": return "google";
    case "fbclid": return "facebook";
  }
  if (input.referrer) {
    try {
      const host = new URL(input.referrer).hostname;
      if (input.ownHost && host.endsWith(input.ownHost)) return "direct";
      for (const [re, ch] of SOCIAL_REFERRERS) if (re.test(host)) return ch;
      if (SEARCH_REFERRERS.test(host)) return "organic";
      return "referral";
    } catch {
      /* fall through */
    }
  }
  return "direct";
}
