import { Suspense } from "react";
import { connection } from "next/server";
import { asc, desc } from "drizzle-orm";
import { PageBody, PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SectionsSkeleton } from "@/components/page-skeleton";
import { ChannelName } from "@/components/channel-dot";
import { CopyButton } from "@/components/copy-button";
import { EmptyHint } from "@/components/setup-notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { formatDateTime } from "@/lib/dates";
import { UTM_PRESETS } from "@/lib/utm";
import { UtmBuilder } from "./utm-builder";

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? "https://store-ihdaa.org.sa/ar";

async function Content() {
  await connection();
  const dbReady = isDatabaseConfigured();
  const [products, links] = dbReady
    ? await Promise.all([
        getDb().select({ id: schema.products.id, name: schema.products.name }).from(schema.products).orderBy(asc(schema.products.name)),
        getDb().select().from(schema.utmLinks).orderBy(desc(schema.utmLinks.createdAt)).limit(20),
      ])
    : [[], []];
  return (
    <>
      <SectionCard title="إنشاء رابط" description="اختر المنصة والصفحة والمشروع، ثم انسخ الرابط إلى الإعلان">
        <UtmBuilder products={products} storeUrl={STORE_URL} />
      </SectionCard>
      <SectionCard title="الروابط المحفوظة" description="آخر 20 رابطًا" contentClassName="px-0">
        {links.length === 0 ? (
          <EmptyHint>لا توجد روابط محفوظة بعد.</EmptyHint>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">المنصة</TableHead>
                <TableHead>الرابط</TableHead>
                <TableHead>أنشأه</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="pe-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="ps-6"><ChannelName channel={UTM_PRESETS[l.platform]?.channel ?? l.platform} /></TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs" dir="ltr">{l.url}</TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">{l.createdBy}</TableCell>
                  <TableCell className="text-muted-foreground tabular">{formatDateTime(l.createdAt)}</TableCell>
                  <TableCell className="pe-6 text-end"><CopyButton text={l.url} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}

export default function UtmPage() {
  return (
    <>
      <PageHeader title="روابط UTM" description="روابط موحّدة تربط كل تبرع بالحملة والإعلان والمشروع" />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}>
          <Content />
        </Suspense>
      </PageBody>
    </>
  );
}
