import { buildUtmUrl, utmParams } from "./utm";

const cases: Array<[string, string, string]> = [
  ["snapchat",
    buildUtmUrl({ platform: "snapchat", url: "https://store-ihdaa.org.sa/ar/p123?ref=x&utm_source=old", term: "p-55" }),
    "https://store-ihdaa.org.sa/ar/p123?ref=x&utm_source=snapchat&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term=p-55"],
  ["tiktok params", utmParams({ platform: "tiktok", url: "https://a.b", term: "Water Project" }),
    "utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_ID__&utm_content=__CID__&utm_term=water-project"],
  ["whatsapp manual", utmParams({ platform: "whatsapp", url: "https://a.b", term: "p-1", campaign: "Ramadan 1" }),
    "utm_source=whatsapp&utm_medium=message&utm_campaign=ramadan-1&utm_term=p-1"],
];
let failed = 0;
for (const [name, got, want] of cases) {
  if (got !== want) { failed++; console.error(`FAIL ${name}\n  got  ${got}\n  want ${want}`); } else console.log(`ok   ${name}`);
}
process.exit(failed ? 1 : 0);
