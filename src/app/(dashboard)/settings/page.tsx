import { Suspense } from "react";
import { connection } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
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
import { formatInt } from "@/lib/format";
import { ChannelName } from "@/components/channel-dot";
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

const REJECT_HELP: Record<string, string> = {
  unauthorized: "المفتاح غير مطابق لـ ORDERS_INGEST_SECRET في Vercel",
  "invalid body": "جسم الطلب ليس بيانات طلب سلة بصيغة JSON",
};

async function OrdersCard() {
  const events = await getDb().select({
    at: schema.webhookEvents.receivedAt, event: schema.webhookEvents.event, processed: schema.webhookEvents.processed,
    error: schema.webhookEvents.error, payload: schema.webhookEvents.payload,
  }).from(schema.webhookEvents).orderBy(desc(schema.webhookEvents.receivedAt)).limit(6);
  const last = events[0];
  const lastOk = events.find((e) => e.processed);
  const configured = !!process.env.ORDERS_INGEST_SECRET;
  const status = !configured ? "off" : lastOk && last === lastOk ? "connected" : last ? "error" : "off";
  return (
    <SectionCard
      title="طلبات سلة (Webhook من سلة)"
      description="بيانات سلة الموثّقة: المبلغ والحالة والمشاريع"
      action={<Status status={status} />}
    >
      <div className="grid gap-3 text-sm">
        <Row label="آخر طلب ناجح">{lastOk ? formatDateTime(lastOk.at) : "لم يصل طلب ناجح بعد"}</Row>
        {events.length > 0 && (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">آخر المحاولات</p>
            {events.map((e, i) => {
              const p = (e.payload ?? {}) as Record<string, unknown>;
              const detail = e.error === "unauthorized"
                ? `الترويسات: ${p.auth_headers ?? "?"} · طول المفتاح المرسل ${JSON.stringify(p.provided_lengths ?? [])} والمتوقع ${p.expected_length ?? "?"}`
                : e.error === "invalid body" ? `نوع المحتوى: ${p.content_type || "?"} · بداية الجسم: ${String(p.start ?? "").slice(0, 80)}` : null;
              return (
                <div key={i} className="rounded-md border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className={e.processed ? "text-success" : "text-destructive"}>
                      {e.processed ? "نجح" : `فشل: ${REJECT_HELP[e.error ?? ""] ?? e.error ?? "غير معروف"}`}
                    </span>
                    <span className="text-muted-foreground tabular">{formatDateTime(e.at)}</span>
                  </div>
                  {detail && <p dir="auto" className="mt-1 break-words text-muted-foreground">{detail}</p>}
                </div>
              );
            })}
          </div>
        )}
        <ol className="grid list-decimal gap-1.5 ps-5 text-muted-foreground">
          <li>في سلة: إعدادات المتجر ← الإعدادات المتقدمة ← Webhooks ← إضافة: الحدث <b>«انشاء فاتورة طلب»</b>، الإصدار V2، والرابط أدناه مع <code dir="ltr">?key=ORDERS_INGEST_SECRET</code>.</li>
          <li>أو في Make: المشغّل <b>Salla → Watch Order Created</b>، ثم <b>HTTP → Make a request</b> بطريقة POST إلى الرابط أدناه.</li>
          <li>المفتاح (ORDERS_INGEST_SECRET) في ترويسة <code dir="ltr">x-api-key</code> أو <code dir="ltr">Authorization</code>، أو في الرابط <code dir="ltr">?key=</code>.</li>
          <li>جسم الطلب: بيانات الطلب من سلة بصيغة JSON (Data كاملة أو الطلب نفسه).</li>
          <li>فعّل السيناريو (ON). زر Run once للتجربة فقط.</li>
        </ol>
        <CodeBlock code={`${appUrl()}/api/ingest/orders`} />
        {!configured && <p className="text-destructive">أضف المتغير <code dir="ltr">ORDERS_INGEST_SECRET</code> في Vercel أولًا.</p>}
      </div>
    </SectionCard>
  );
}

async function TrackingCard() {
  const db = getDb();
  const [stats] = await db.execute<{ last: string | null; sessions: string; tagged: string; by_app: string; untagged: string }>(sql`
    select max(visited_at) last, count(distinct session_id) sessions,
      count(distinct session_id) filter (where utm_source is not null or click_id is not null) tagged,
      count(distinct session_id) filter (where utm_source is null and click_id is null and ua_app is not null) by_app,
      count(distinct session_id) filter (where channel = 'direct') untagged
    from visits where visited_at > now() - interval '24 hours'`);
  const byChannel = await db.execute<{ channel: string; sessions: string }>(sql`
    select channel, count(distinct session_id) sessions from visits
    where visited_at > now() - interval '24 hours' group by 1 order by 2 desc`);
  const n = (v: string | undefined) => Number(v ?? 0);
  return (
    <SectionCard
      title="سكربت التتبع في المتجر"
      description="يحفظ مصدر الزائر ويبلغ عن التبرع مع رقم الطلب"
      action={<Status status={stats?.last ? "connected" : "off"} />}
    >
      <div className="grid gap-3 text-sm">
        <div>
          <Row label="آخر زيارة مسجّلة">{stats?.last ? formatDateTime(stats.last) : "لم تصل زيارات بعد"}</Row>
          <Row label="زيارات آخر 24 ساعة">{formatInt(n(stats?.sessions))}</Row>
          <Row label="معروفة من الرابط (UTM أو معرّف النقر)">{formatInt(n(stats?.tagged))}</Row>
          <Row label="معروفة من متصفح التطبيق (سناب، تيك توك…)">{formatInt(n(stats?.by_app))}</Row>
          <Row label="بدون مصدر (مباشر)">{formatInt(n(stats?.untagged))}</Row>
        </div>
        {byChannel.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {byChannel.map((c) => <span key={c.channel} className="inline-flex items-center gap-1.5"><ChannelName channel={c.channel} /> {formatInt(n(c.sessions))}</span>)}
          </div>
        )}
        <p className="text-muted-foreground">
          في Google Tag Manager: وسم <b>Custom HTML</b> بالمشغّل <b>All Pages</b> يحتوي السطر التالي.
        </p>
        <CodeBlock code={`<script src="${appUrl()}/t.js" async></script>`} />
        <p className="text-xs text-muted-foreground">
          للتجربة: افتح المتجر مع <code dir="ltr">?ihd_debug=1</code> وراقب Console.
          إعلانات سناب شات بدون UTM تُنسب لسناب شات من متصفح التطبيق، لكن بدون اسم الحملة؛ أضف UTM للإعلان لمعرفة الحملة.
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
