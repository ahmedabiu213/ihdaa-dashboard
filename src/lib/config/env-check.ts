import "server-only";

/** Which settings are present (never their values), grouped by feature. */
export const ENV_GROUPS: Array<{ title: string; vars: Array<{ name: string; optional?: boolean }> }> = [
  { title: "الأساس", vars: [{ name: "DATABASE_URL" }, { name: "NEXT_PUBLIC_SUPABASE_URL" }, { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" }, { name: "SUPABASE_SERVICE_ROLE_KEY" }, { name: "NEXT_PUBLIC_APP_URL" }, { name: "TOKEN_ENCRYPTION_KEY" }, { name: "CRON_SECRET" }] },
  { title: "المتجر", vars: [{ name: "STORE_ORIGINS" }, { name: "NEXT_PUBLIC_STORE_URL", optional: true }, { name: "ORDERS_INGEST_SECRET" }, { name: "SALLA_WEBHOOK_SECRET", optional: true }] },
  { title: "سناب شات", vars: [{ name: "SNAPCHAT_CLIENT_ID" }, { name: "SNAPCHAT_CLIENT_SECRET" }, { name: "SNAPCHAT_AD_ACCOUNT_ID" }] },
  { title: "تيك توك", vars: [{ name: "TIKTOK_APP_ID" }, { name: "TIKTOK_APP_SECRET" }, { name: "TIKTOK_ADVERTISER_ID", optional: true }] },
  { title: "قوقل", vars: [{ name: "GOOGLE_ADS_INGEST_SECRET" }] },
];

const squash = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Names in the environment that look like `expected` but aren't exactly it: a stray space,
 * an invisible character, lower case, or a whole `NAME=value` line pasted into the name box.
 * Only the name part is returned, never anything after "=", so no secret is shown.
 */
function nearMisses(expected: string): string[] {
  const want = squash(expected);
  return Object.keys(process.env)
    .filter((k) => k !== expected)
    .filter((k) => { const s = squash(k.split("=")[0]); return s === want || (s.startsWith(want) && k.includes("=")); })
    .map((k) => (k.includes("=") ? `${k.split("=")[0]}=…` : k))
    .map((k) => JSON.stringify(k)); // quotes make leading/trailing spaces visible
}

export function envStatus() {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  const keyOk = !key || Buffer.from(key, "base64").length === 32;
  return {
    groups: ENV_GROUPS.map((g) => ({
      ...g,
      vars: g.vars.map((v) => {
        const value = process.env[v.name];
        const set = !!value?.trim();
        return { ...v, set, empty: value != null && !set, nearMisses: set ? [] : nearMisses(v.name) };
      }),
    })),
    deployment: {
      env: process.env.VERCEL_ENV ?? null, // production | preview | development
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    problems: [
      ...(keyOk ? [] : ["TOKEN_ENCRYPTION_KEY يجب أن يكون 32 بايت بصيغة base64 (openssl rand -base64 32)."]),
      ...(process.env.NEXT_PUBLIC_APP_URL && !/^https?:\/\//.test(process.env.NEXT_PUBLIC_APP_URL) ? ["NEXT_PUBLIC_APP_URL يجب أن يبدأ بـ https://"] : []),
      ...(process.env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL) ? ["DATABASE_URL يجب أن يبدأ بـ postgresql://"] : []),
    ],
  };
}
