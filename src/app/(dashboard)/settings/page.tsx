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
import { disconnectSnapchat } from "./actions";
import { SnapchatSyncForm } from "./sync-form";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://ihdaa-dashboard.vercel.app").replace(/\/$/, "");

const FLASH: Record<string, { tone: "ok" | "error"; text: string }> = {
  "connected=snapchat": { tone: "ok", text: "تم ربط سناب شات. تجري الآن مزامنة آخر 90 يوم في الخلفية." },
  "error=snapchat-denied": { tone: "error", text: "تم إلغاء الربط من صفحة سناب شات." },
  "error=snapchat-state": { tone: "error", text: "انتهت صلاحية طلب الربط. حاول مرة أخرى." },
  "error=snapchat-token": { tone: "error", text: "رفض سناب شات طلب الربط. تأكد من Client Secret ورابط إعادة التوجيه." },
  "error=snapchat-config": { tone: "error", text: "متغيرات سناب شات غير مكتملة في إعدادات Vercel." },
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

async function SnapchatCard() {
  const cfg = snapchatConfig();
  const [row, runs, account] = await Promise.all([
    getIntegration("snapchat"),
    recentRuns("snapchat", 3),
    getDb().select().from(schema.adAccounts).where(eq(schema.adAccounts.platform, "snapchat")).limit(1),
  ]);
  const connected = !!row?.refreshTokenEnc;
  const status = !connected ? "off" : row?.status === "error" ? "error" : "connected";
  const acc = account[0];
  return (
    <SectionCard title="سناب شات" description="الإنفاق والظهور والنقرات لكل إعلان يوميًا" action={<Status status={status} />}>
      <div className="grid gap-4">
        {!cfg && (
          <p className="text-sm text-destructive">
            أضف في Vercel: <code dir="ltr">SNAPCHAT_CLIENT_ID</code>، <code dir="ltr">SNAPCHAT_CLIENT_SECRET</code>،
            {" "}<code dir="ltr">SNAPCHAT_AD_ACCOUNT_ID</code>، <code dir="ltr">TOKEN_ENCRYPTION_KEY</code>.
          </p>
        )}
        <div>
          <Row label="الحساب الإعلاني">{acc ? `${acc.name ?? ""}` : (cfg ? <span dir="ltr">{cfg.adAccountId}</span> : "—")}</Row>
          <Row label="العملة / المنطقة الزمنية"><span dir="ltr">{acc ? `${acc.currency} · ${acc.timezone}` : "—"}</span></Row>
          <Row label="آخر مزامنة">{row?.lastSyncAt ? formatDateTime(row.lastSyncAt) : "—"}</Row>
          {runs[0] && <Row label="آخر تشغيل">{runs[0].status === "ok" ? `نجح (${runs[0].rows} صف)` : runs[0].status === "running" ? "قيد التشغيل" : "فشل"}</Row>}
        </div>
        {acc && acc.timezone !== "Asia/Riyadh" && (
          <p className="text-sm text-muted-foreground">
            المنطقة الزمنية للحساب ليست الرياض، لذلك قد تختلف حدود الأيام قليلًا عن أيام المتجر.
          </p>
        )}
        {row?.lastError && <p className="text-sm break-words text-destructive" dir="auto">{row.lastError}</p>}
        {cfg && (
          <div className="flex flex-wrap items-start gap-3">
            {connected && <SnapchatSyncForm />}
            <Button asChild size="sm" variant={connected ? "outline" : "default"}>
              {/* Full navigation: the route redirects to Snapchat's consent page. */}
              <a href="/api/oauth/snapchat/start">{connected ? "إعادة الربط" : "ربط سناب شات"}</a>
            </Button>
            {connected && (
              <form action={disconnectSnapchat}>
                <Button type="submit" size="sm" variant="ghost">فصل</Button>
              </form>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          رابط إعادة التوجيه في تطبيق Snap OAuth: <code dir="ltr">{appUrl()}/api/oauth/snapchat/callback</code>
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

function OtherPlatformsCard() {
  const items = [
    { name: "تيك توك", note: "بانتظار موافقة TikTok على التطبيق" },
    { name: "إعلانات قوقل", note: "سكربت Google Ads (قريبًا)" },
    { name: "ميتا (انستقرام وفيسبوك وواتساب)", note: "قريبًا" },
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

async function Content({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
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
        <SnapchatCard />
        <OrdersCard />
        <TrackingCard />
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
