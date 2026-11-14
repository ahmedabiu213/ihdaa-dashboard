import { Suspense } from "react";
import { connection } from "next/server";
import { desc, inArray, sql } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SectionsSkeleton } from "@/components/page-skeleton";
import { EmptyHint, SetupNotice } from "@/components/setup-notice";
import { ChannelName } from "@/components/channel-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { formatDay, riyadhToday } from "@/lib/dates";
import { formatInt, formatSar, toNumber } from "@/lib/format";
import { SPEND_CSV_TEMPLATE } from "@/lib/import/spend";
import { deleteSpend } from "./actions";
import { CsvSpendForm, ManualSpendForm } from "./spend-forms";

const SOURCE_LABEL: Record<string, string> = { api: "ربط مباشر", script: "سكربت قوقل", manual: "يدوي", csv: "ملف CSV" };

async function Content() {
  await connection();
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const db = getDb();
  const [summary, recent] = await Promise.all([
    db.execute<{ platform: string; source: string; spend: string; days: string }>(sql`
      select platform, source, sum(spend_sar) spend, count(distinct date) days
      from spend_daily where date >= (current_date - 27) group by 1, 2 order by 1, 2`),
    db.select().from(schema.spendDaily)
      .where(inArray(schema.spendDaily.source, ["manual", "csv"]))
      .orderBy(desc(schema.spendDaily.date), desc(schema.spendDaily.updatedAt)).limit(50),
  ]);
  const byPlatform = new Map<string, Set<string>>();
  for (const s of summary) byPlatform.set(s.platform, (byPlatform.get(s.platform) ?? new Set()).add(s.source));
  const overlaps = [...byPlatform].filter(([, set]) => set.has("api") && (set.has("manual") || set.has("csv"))).map(([p]) => p);

  return (
    <>
      {overlaps.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          تنبيه: يوجد إنفاق يدوي لمنصة مربوطة مباشرة ({overlaps.join("، ")}). قد يُحسب الإنفاق مرتين؛ احذف الإدخال اليدوي لهذه المنصة.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="إدخال يدوي" description="للمنصات غير المربوطة: ميتا، واتساب، قوقل حتى يُفعّل السكربت">
          <ManualSpendForm today={riyadhToday()} />
        </SectionCard>
        <SectionCard title="رفع ملف CSV" description="عدة أيام أو منصات دفعة واحدة">
          <CsvSpendForm template={SPEND_CSV_TEMPLATE} />
        </SectionCard>
      </div>
      <SectionCard title="مصادر الإنفاق" description="آخر 28 يوم" contentClassName="px-0">
        {summary.length === 0 ? <EmptyHint>لا يوجد إنفاق مسجّل في آخر 28 يوم.</EmptyHint> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="ps-6">المنصة</TableHead><TableHead>المصدر</TableHead>
              <TableHead className="text-end">أيام بها إنفاق</TableHead><TableHead className="pe-6 text-end">الإنفاق</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {summary.map((s) => (
                <TableRow key={`${s.platform}-${s.source}`}>
                  <TableCell className="ps-6"><ChannelName channel={s.platform} /></TableCell>
                  <TableCell><Badge variant="outline">{SOURCE_LABEL[s.source] ?? s.source}</Badge></TableCell>
                  <TableCell className="text-end tabular">{formatInt(toNumber(s.days))}</TableCell>
                  <TableCell className="pe-6 text-end tabular">{formatSar(toNumber(s.spend))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <SectionCard title="الإدخالات اليدوية والملفات" description="آخر 50 إدخال" contentClassName="px-0">
        {recent.length === 0 ? <EmptyHint>لا توجد إدخالات يدوية بعد.</EmptyHint> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="ps-6">اليوم</TableHead><TableHead>المنصة</TableHead><TableHead>الحملة</TableHead>
              <TableHead>المصدر</TableHead><TableHead className="text-end">المبلغ</TableHead>
              <TableHead className="text-end">بالريال</TableHead><TableHead>ملاحظة</TableHead><TableHead className="pe-6" />
            </TableRow></TableHeader>
            <TableBody>
              {recent.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="ps-6 tabular">{formatDay(r.date)}</TableCell>
                  <TableCell><ChannelName channel={r.platform} /></TableCell>
                  <TableCell dir="ltr" className="text-start text-muted-foreground">{r.campaignId || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{SOURCE_LABEL[r.source]}</Badge></TableCell>
                  <TableCell className="text-end tabular" dir="ltr">{toNumber(r.spend).toFixed(2)} {r.currency}</TableCell>
                  <TableCell className="text-end tabular">{formatSar(toNumber(r.spendSar), true)}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{r.note ?? ""}</TableCell>
                  <TableCell className="pe-6 text-end">
                    <form action={deleteSpend}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" size="icon" variant="ghost" aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}

export default function SpendPage() {
  return (
    <>
      <PageHeader title="الإنفاق اليدوي" description="إدخال الإنفاق للمنصات غير المربوطة أو رفع ملف CSV" />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}><Content /></Suspense>
      </PageBody>
    </>
  );
}
