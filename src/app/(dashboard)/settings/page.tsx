import { Suspense } from "react";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, CircleAlert, CircleDashed, Clock } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SectionsSkeleton } from "@/components/page-skeleton";
import { SetupNotice } from "@/components/setup-notice";
import { CodeBlock } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { formatDateTime } from "@/lib/dates";
import { getIntegration, recentRuns } from "@/lib/integrations/store";
import { snapchatConfig } from "@/lib/snapchat/client";
import { tiktokConfig } from "@/lib/tiktok/client";
import { googleAdsScript } from "@/lib/google/script";
import { envStatus } from "@/lib/config/env-check";
import { disconnect } from "./actions";
import { SyncForm } from "./sync-form";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://ihdaa-dashboard.vercel.app").replace(/\/$/, "");

const FLASH: Record<string, { tone: "ok" | "error"; text: string }> = {
  "connected=snapchat": { tone: "ok", text: "تم ربط سناب شات. تجري الآن مزامنة آخر 90 يوم في الخلفية." },
  "error=snapchat-denied": { tone: "error", text: "تم إلغاء الربط من صفحة سناب شات." },
  "error=snapchat-state": { tone: "error", text: "انتهت صلاحية طلب الربط. حاول مرة أخرى." },
  "error=snapchat-token": { tone: "error", text: "رفض سناب شات طلب الربط. تأكد من Client Secret ورابط إعادة التوجيه." },
  "error=snapchat-config": { tone: "error", text: "متغيرات سناب شات غير مكتملة في إعدادات Vercel." },
  "connected=tiktok": { tone: "ok", text: "تم ربط تيك توك. تجري الآن مزامنة آخر 90 يوم في الخلفية." },
  "error=tiktok-denied": { tone: "error", text: "تم إلغاء الربط من صفحة تيك توك." },
  "error=tiktok-state": { tone: "error", text: "انتهت صلاحية طلب الربط. حاول مرة أخرى." },
  "error=tiktok-token": { tone: "error", text: "رفض تيك توك طلب الربط. تأكد من App ID و Secret ورابط إعادة التوجيه." },
  "error=tiktok-config": { tone: "error", text: "متغيرات تيك توك غير مكتملة في إعدادات Vercel." },
};

function Status({ status }: { status: "connected" | "error" | "pending" | "off" }) {
  const map = {
    connected: { icon: CheckCircle2, text: "مربوط", cls: "text-success" },
    error: { icon: CircleAlert, text: "خطأ", cls: "text-destructive" },
    pending: { icon: Clock, text: "بانتظار الموافقة", cls: "text-muted-foreground" },
    off: { icon: CircleDashed, text: "غير مربوط", cls: "text-muted-foreground" },
  }[status];
  return (
    <Badge variant="outline" className={`gap-1 ${map.cls}`}>
      <map.icon className="size-3.5" />
      {map.text}
    </Badge>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

type PlatformDef = {
  key: "snapchat" | "tiktok";
  title: string;
  description: string;
  configured: boolean;
  accountHint: string | null;
  envNames: string[];
  connectedBy: "refreshTokenEnc" | "accessTokenEnc";
};

function platformDefs(): PlatformDef[] {
  const snap = snapchatConfig();
  const tt = tiktokConfig();
  return [
    {
      key: "snapchat", title: "سناب شات", description: "الإنفاق والظهور والنقرات لكل إعلان يوميًا",
      configured: !!snap, accountHint: snap?.adAccountId ?? null, connectedBy: "refreshTokenEnc",
      envNames: ["SNAPCHAT_CLIENT_ID", "SNAPCHAT_CLIENT_SECRET", "SNAPCHAT_AD_ACCOUNT_ID", "TOKEN_ENCRYPTION_KEY"],
    },
    {
      key: "tiktok", title: "تيك توك", description: "الإنفاق والظهور والنقرات لكل إعلان يوميًا",
      configured: !!tt, accountHint: tt?.advertiserId ?? null, connectedBy: "accessTokenEnc",
      envNames: ["TIKTOK_APP_ID", "TIKTOK_APP_SECRET", "TOKEN_ENCRYPTION_KEY"],
    },
  ];
}

async function PlatformCard({ def }: { def: PlatformDef }) {
  const [row, runs, account] = await Promise.all([
    getIntegration(def.key),
    recentRuns(def.key, 3),
    getDb().select().from(schema.adAccounts).where(eq(schema.adAccounts.platform, def.key)).limit(1),
  ]);
  const connected = !!row?.[def.connectedBy];
  const status = !connected ? "off" : row?.status === "error" ? "error" : "connected";
  const acc = account[0];
  return (
    <SectionCard title={def.title} description={def.description} action={<Status status={status} />}>
      <div className="grid gap-4">
        {!def.configured && (
          <p className="text-sm text-destructive">
            أضف في Vercel:{" "}
            {def.envNames.map((n, i) => <span key={n}>{i > 0 && "، "}<code dir="ltr">{n}</code></span>)}
          </p>
        )}
        <div>
          <Row label="الحساب الإعلاني">{acc?.name ?? (def.accountHint ? <span dir="ltr">{def.accountHint}</span> : "—")}</Row>
          <Row label="العملة / المنطقة الزمنية"><span dir="ltr">{acc ? `${acc.currency ?? "?"} · ${acc.timezone ?? "?"}` : "—"}</span></Row>
          <Row label="آخر مزامنة">{row?.lastSyncAt ? formatDateTime(row.lastSyncAt) : "—"}</Row>
          {runs[0] && <Row label="آخر تشغيل">{runs[0].status === "ok" ? `نجح (${runs[0].rows} صف)` : runs[0].status === "running" ? "قيد التشغيل" : "فشل"}</Row>}
        </div>
        {acc?.timezone && !/Riyadh|GMT\+03|UTC\+03|Etc\/GMT-3/i.test(acc.timezone) && (
          <p className="text-sm text-muted-foreground">
            المنطقة الزمنية للحساب ليست الرياض، لذلك قد تختلف حدود الأيام قليلًا عن أيام المتجر.
          </p>
        )}
        {row?.lastError && <p className="text-sm break-words text-destructive" dir="auto">{row.lastError}</p>}
        {def.configured && (
          <div className="flex flex-wrap items-start gap-3">
            {connected && <SyncForm platform={def.key} />}
            <Button asChild size="sm" variant={connected ? "outline" : "default"}>
              {/* Full navigation: the route redirects to the platform's consent page. */}
              <a href={`/api/oauth/${def.key}/start`}>{connected ? "إعادة الربط" : `ربط ${def.title}`}</a>
            </Button>
            {connected && (
              <form action={disconnect}>
                <input type="hidden" name="platform" value={def.key} />
                <Button type="submit" size="sm" variant="ghost">فصل</Button>
              </form>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          رابط إعادة التوجيه في التطبيق: <code dir="ltr">{appUrl()}/api/oauth/{def.key}/callback</code>
        </p>
      </div>
    </SectionCard>
  );
}

async function OrdersCard() {
  const [last] = await getDb().select({ at: schema.webhookEvents.receivedAt, error: schema.webhookEvents.error })
    .from(schema.webhookEvents).orderBy(desc(schema.webhookEvents.receivedAt)).limit(1);
  const configured = !!process.env.ORDERS_INGEST_SECRET;
  return (
    <SectionCard
      title="طلبات سلة عبر Make.com"
      description="بيانات سلة الموثّقة: المبلغ والحالة والمشاريع"
      action={<Status status={!configured ? "off" : last?.error ? "error" : last ? "connected" : "off"} />}
    >
      <div className="grid gap-3 text-sm">
        <Row label="آخر طلب وصل">{last ? formatDateTime(last.at) : "لم يصل شيء بعد"}</Row>
        <ol className="grid list-decimal gap-1.5 ps-5 text-muted-foreground">
          <li>في Make: سيناريو جديد، المشغّل <b>Salla → Watch Order Created</b>.</li>
          <li>سيناريو ثانٍ بالمشغّل <b>Watch Order Payment Updated</b> لتحديث حالة الدفع.</li>
          <li>أضف <b>HTTP → Make a request</b> بطريقة POST إلى الرابط التالي، وجسم الطلب JSON يحتوي الطلب كاملًا.</li>
          <li>أضف الترويسة <code dir="ltr">Authorization: Bearer ORDERS_INGEST_SECRET</code> (القيمة من إعدادات Vercel).</li>
        </ol>
        <CodeBlock code={`${appUrl()}/api/ingest/orders`} />
        {!configured && <p className="text-destructive">أضف المتغير <code dir="ltr">ORDERS_INGEST_SECRET</code> في Vercel أولًا.</p>}
      </div>
    </SectionCard>
  );
}

function TrackingCard() {
  return (
    <SectionCard title="سكربت التتبع في المتجر" description="يحفظ مصدر الزائر ويبلغ عن التبرع مع رقم الطلب">
      <div className="grid gap-3 text-sm">
        <p className="text-muted-foreground">
          في Google Tag Manager: وسم جديد من نوع <b>Custom HTML</b>، المشغّل <b>All Pages</b>، والصق السطر التالي ثم انشر.
        </p>
        <CodeBlock code={`<script src="${appUrl()}/t.js" async></script>`} />
        <p className="text-muted-foreground">
          للتجربة: افتح المتجر مع <code dir="ltr">?ihd_debug=1</code> وراقب Console في المتصفح.
          تأكد أن <code dir="ltr">STORE_ORIGINS</code> في Vercel يساوي رابط المتجر.
        </p>
      </div>
    </SectionCard>
  );
}

async function GoogleCard() {
  const secret = process.env.GOOGLE_ADS_INGEST_SECRET;
  const row = await getIntegration("google");
  return (
    <SectionCard
      title="إعلانات قوقل"
      description="سكربت داخل حساب Google Ads يرسل الإنفاق لكل حملة كل ساعة"
      action={<Status status={!secret ? "off" : row?.lastSyncAt ? (row.lastError ? "error" : "connected") : "off"} />}
    >
      <div className="grid gap-3 text-sm">
        <Row label="آخر استلام">{row?.lastSyncAt ? formatDateTime(row.lastSyncAt) : "لم يصل شيء بعد"}</Row>
        {!secret ? (
          <p className="text-destructive">أضف المتغير <code dir="ltr">GOOGLE_ADS_INGEST_SECRET</code> في Vercel ثم أعد النشر ليظهر السكربت هنا.</p>
        ) : (
          <>
            <ol className="grid list-decimal gap-1.5 ps-5 text-muted-foreground">
              <li>في Google Ads: <b>Tools → Bulk actions → Scripts</b> ثم زر <b>+</b>.</li>
              <li>الصق السكربت التالي بالكامل مكان المحتوى الموجود، ثم <b>Authorize</b>.</li>
              <li>للمرة الأولى: غيّر <code dir="ltr">DAYS = 7</code> إلى <code dir="ltr">90</code> واضغط <b>Run</b>، ثم أعدها إلى 7.</li>
              <li>اضبط الجدولة على <b>Hourly</b> واحفظ.</li>
            </ol>
            <CodeBlock code={googleAdsScript(`${appUrl()}/api/ingest/google`, secret)} />
            <p className="text-xs text-muted-foreground">السكربت يحتوي مفتاحًا سريًا؛ لا تشاركه خارج حساب Google Ads.</p>
          </>
        )}
      </div>
    </SectionCard>
  );
}

function OtherPlatformsCard() {
  const items = [
    { name: "ميتا (انستقرام وفيسبوك وواتساب)", note: "إدخال يدوي أو ملف CSV من صفحة الإنفاق اليدوي" },
  ];
  return (
    <SectionCard title="منصات أخرى" description="حتى يتم ربطها يمكن إدخال إنفاقها يدويًا">
      <div>
        {items.map((i) => (
          <Row key={i.name} label={i.name}><span className="text-muted-foreground">{i.note}</span></Row>
        ))}
      </div>
    </SectionCard>
  );
}

function EnvCard() {
  const { groups, problems } = envStatus();
  const missing = groups.flatMap((g) => g.vars.filter((v) => !v.set && !v.optional));
  return (
    <SectionCard
      title="فحص الإعدادات"
      description="متغيرات البيئة في Vercel (تُعرض الأسماء فقط، لا القيم)"
      action={<Status status={missing.length || problems.length ? "error" : "connected"} />}
      className="lg:col-span-2"
    >
      <div className="grid gap-3">
        {problems.map((p) => <p key={p} className="text-sm text-destructive">{p}</p>)}
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title} className="grid content-start gap-1">
              <p className="text-xs font-medium text-muted-foreground">{g.title}</p>
              {g.vars.map((v) => (
                <p key={v.name} className="flex min-w-0 items-center gap-1.5 text-xs" dir="ltr">
                  {v.set ? <CheckCircle2 className="size-3.5 shrink-0 text-success" /> : v.optional ? <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" /> : <CircleAlert className="size-3.5 shrink-0 text-destructive" />}
                  <code className="min-w-0 break-all">{v.name}</code>
                </p>
              ))}
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-muted-foreground">بعد إضافة أي متغير في Vercel: Deployments ← Redeploy حتى يأخذ مفعوله.</p>
        )}
      </div>
    </SectionCard>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <><div className="grid gap-4 lg:grid-cols-2"><EnvCard /></div><SetupNotice /></>;
  const key = Object.keys(FLASH).find((k) => { const [n, v] = k.split("="); return sp[n] === v; });
  const flash = key ? FLASH[key] : null;
  return (
    <>
      {flash && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${flash.tone === "ok" ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
          {flash.text}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <EnvCard />
        {platformDefs().map((d) => <PlatformCard key={d.key} def={d} />)}
        <OrdersCard />
        <TrackingCard />
        <GoogleCard />
        <OtherPlatformsCard />
      </div>
    </>
  );
}

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <>
      <PageHeader title="الربط والمزامنة" description="ربط المنصات وحالة المزامنة وأكواد التثبيت" />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}
