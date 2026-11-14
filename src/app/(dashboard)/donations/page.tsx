import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { FilterSkeleton, SectionsSkeleton } from "@/components/page-skeleton";
import { SectionCard } from "@/components/section-card";
import { EmptyHint, SetupNotice } from "@/components/setup-notice";
import { ChannelName } from "@/components/channel-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rangeLabel } from "@/components/overview/overview-sections";
import { isDatabaseConfigured } from "@/db";
import { formatDateTime } from "@/lib/dates";
import { formatInt, formatSar } from "@/lib/format";
import { parseFilters } from "@/lib/queries/filters";
import { listDonations } from "@/lib/queries/donations";
import { donationFilters } from "@/lib/queries/donation-filters";
import { DonationFilters, ImportOrdersForm } from "./donation-controls";

const PAGE_SIZE = 50;
const SOURCE: Record<string, string> = { make: "Make", salla_webhook: "سلة", import: "ملف سلة", browser: "سكربت المتجر" };
const STATUS: Record<string, string> = {
  completed: "مكتمل", delivered: "تم التوصيل", delivering: "جاري التوصيل", shipped: "تم الشحن", in_progress: "قيد التنفيذ",
  under_review: "بانتظار المراجعة", payment_pending: "بانتظار الدفع", canceled: "ملغي", restored: "مسترجع",
};

async function Content({ searchParams }: { searchParams: PageProps<"/donations">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const f = donationFilters(sp, parseFilters(sp));
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const { rows, total, revenue } = await listDonations(f, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const next = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v == null ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x]))));
    next.set("page", String(p));
    return `/donations?${next.toString()}`;
  };

  return (
    <>
      <SectionCard
        title="سجل التبرعات"
        description={`${rangeLabel(f.range)} · ${formatInt(total)} طلب · ${formatSar(revenue)} مدفوعة`}
        contentClassName="px-0"
      >
        {rows.length === 0 ? <EmptyHint>لا توجد طلبات تطابق الفلاتر.</EmptyHint> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="ps-6">رقم الطلب</TableHead><TableHead>الوقت</TableHead><TableHead>المشروع</TableHead>
              <TableHead>القناة</TableHead><TableHead>الحملة</TableHead><TableHead>الحالة</TableHead>
              <TableHead>المصدر</TableHead><TableHead className="pe-6 text-end">المبلغ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.countsAsRevenue ? undefined : "text-muted-foreground"}>
                  <TableCell className="ps-6 tabular" dir="ltr">{r.reference ?? r.sallaId ?? r.id}</TableCell>
                  <TableCell className="whitespace-nowrap tabular">{formatDateTime(r.orderedAt)}</TableCell>
                  <TableCell className="max-w-56 truncate">{r.projects ?? "—"}</TableCell>
                  <TableCell><ChannelName channel={r.channel} /></TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">{r.campaign ?? r.utmCampaign ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.countsAsRevenue ? "secondary" : "outline"}>{r.status ? (STATUS[r.status] ?? r.status) : "مدفوع"}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs">
                      {r.verified ? <ShieldCheck className="size-3.5 text-success" /> : <ShieldAlert className="size-3.5 text-muted-foreground" />}
                      {SOURCE[r.source] ?? r.source}
                    </span>
                  </TableCell>
                  <TableCell className="pe-6 text-end font-medium tabular">{formatSar(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 px-6 pt-4 text-sm">
            <span className="text-muted-foreground">صفحة {page} من {pages}</span>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" disabled={page <= 1}>
                {page > 1 ? <Link href={pageHref(page - 1)}>السابق</Link> : <span>السابق</span>}
              </Button>
              <Button asChild size="sm" variant="outline" disabled={page >= pages}>
                {page < pages ? <Link href={pageHref(page + 1)}>التالي</Link> : <span>التالي</span>}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
      <SectionCard title="استيراد طلبات سلة" description="شبكة أمان: يصحّح المبالغ والحالات ويضيف أي طلب فات التتبع">
        <ImportOrdersForm />
      </SectionCard>
    </>
  );
}

export default function DonationsPage(props: PageProps<"/donations">) {
  return (
    <>
      <PageHeader
        title="التبرعات"
        description="كل الطلبات ومصدر كل تبرع"
        actions={<Suspense fallback={<FilterSkeleton />}><DonationFilters /><FilterBar /></Suspense>}
      />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}><Content searchParams={props.searchParams} /></Suspense>
      </PageBody>
    </>
  );
}
