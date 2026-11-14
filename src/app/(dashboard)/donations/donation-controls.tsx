"use client";

import { useActionState, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importOrders, type ImportState } from "./actions";

export function DonationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, start] = useTransition();
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={(e) => { e.preventDefault(); set("q", q.trim() || null); }} className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم الطلب أو المشروع" className="h-8 w-56 bg-card ps-8" />
      </form>
      <Select value={params.get("status") ?? "all"} onValueChange={(v) => set("status", v === "all" ? null : v)}>
        <SelectTrigger size="sm" className="bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل الحالات</SelectItem>
          <SelectItem value="paid">مدفوعة (تُحسب)</SelectItem>
          <SelectItem value="unpaid">غير مدفوعة أو ملغاة</SelectItem>
        </SelectContent>
      </Select>
      <Select value={params.get("verified") ?? "all"} onValueChange={(v) => set("verified", v === "all" ? null : v)}>
        <SelectTrigger size="sm" className="bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">موثّقة وغير موثّقة</SelectItem>
          <SelectItem value="yes">موثّقة من سلة</SelectItem>
          <SelectItem value="no">من سكربت المتجر فقط</SelectItem>
        </SelectContent>
      </Select>
      <Button asChild size="sm" variant="outline">
        <a href={`/api/export/donations?${params.toString()}`}><Download />تصدير CSV</a>
      </Button>
    </div>
  );
}

export function ImportOrdersForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importOrders, {});
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5 sm:max-w-md">
        <Label htmlFor="orders-file">ملف تصدير الطلبات من سلة (CSV)</Label>
        <Input id="orders-file" name="file" type="file" accept=".csv,text/csv" required />
      </div>
      <p className="text-xs text-muted-foreground">
        من لوحة سلة: الطلبات ← تصدير. افتح الملف في Excel واحفظه بصيغة <b>CSV UTF-8</b>. الطلبات الموجودة تُحدَّث ولا تتكرر،
        وتصبح موثّقة. الأعمدة المطلوبة: رقم الطلب، التاريخ، الإجمالي.
      </p>
      <div><Button type="submit" disabled={pending}><Upload />{pending ? "جارٍ الاستيراد…" : "استيراد الطلبات"}</Button></div>
      {state.ok && <p className="text-sm text-success">{state.ok}</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.details?.map((d) => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
    </form>
  );
}
