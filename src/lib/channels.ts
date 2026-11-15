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

/** Platform auto-tagging spells sources many ways: "TikTok", "tiktok_ads", "snapchat-ads", "Instagram_Feed"… */
const FUZZY_SOURCES: Array<[RegExp, Channel]> = [
  [/tik.?tok/, "tiktok"],
  [/snap/, "snapchat"],
  [/insta/, "instagram"],
  [/whats.?app/, "whatsapp"],
  [/face.?book|^fb[_\-]|meta/, "facebook"],
  [/google|adwords|gads|youtube/, "google"],
];
function fuzzySource(src: string): Channel | null {
  for (const [re, ch] of FUZZY_SOURCES) if (re.test(src)) return ch;
  return null;
}

// Only the search sites themselves, not other Google hosts (tagassistant.google.com, mail.google.com…).
const SEARCH_REFERRERS = /^(www\.|m\.|search\.)?(google|bing|yahoo|duckduckgo|yandex)\.[a-z.]{2,6}$/i;
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
  uaApp?: Channel | null;
}): Channel {
  const src = input.utmSource?.trim().toLowerCase();
  if (src) return SOURCE_ALIASES[src] ?? (isChannel(src) ? src : fuzzySource(src) ?? "other");
  switch (input.clickIdType) {
    case "sccid": return "snapchat";
    case "ttclid": return "tiktok";
    case "gclid": case "gbraid": case "wbraid": return "google";
    case "fbclid": return "facebook";
  }
  if (input.referrer) {
    try {
      const host = new URL(input.referrer).hostname;
      if (!(input.ownHost && host.endsWith(input.ownHost))) {
        for (const [re, ch] of SOCIAL_REFERRERS) if (re.test(host)) return ch;
        // A visit inside an app's own browser belongs to that app even if it passed through a link page.
        if (input.uaApp) return input.uaApp;
        if (SEARCH_REFERRERS.test(host)) return "organic";
        return "referral";
      }
    } catch {
      /* fall through */
    }
  }
  // No tags and no referrer: apps like Snapchat open links in their own browser,
  // which sends no referrer but identifies itself in the User-Agent.
  return input.uaApp ?? "direct";
}

const UA_APPS: Array<[RegExp, Channel]> = [
  [/Snapchat/i, "snapchat"],
  [/musical_ly|BytedanceWebview|TikTok|trill_/i, "tiktok"],
  [/Instagram/i, "instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "facebook"],
  [/WhatsApp/i, "whatsapp"],
];

/** Which app's built-in browser a request came from, if any. */
export function appFromUserAgent(ua: string | null | undefined): Channel | null {
  if (!ua) return null;
  for (const [re, ch] of UA_APPS) if (re.test(ua)) return ch;
  return null;
}

const BOT_UA = /bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|facebookexternalhit|preview/i;
export const isBotUserAgent = (ua: string | null | undefined) => !ua || BOT_UA.test(ua);
