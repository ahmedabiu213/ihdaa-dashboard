"use client";

import { useActionState, useRef } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHANNELS, SPEND_PLATFORMS } from "@/lib/channels";
import { addSpend, importSpend, type FormState } from "./actions";

function Result({ state }: { state: FormState }) {
  if (!state.ok && !state.error) return null;
  return (
    <div className="grid gap-1 text-sm">
      {state.ok && <p className="text-success">{state.ok}</p>}
      {state.error && <p className="text-destructive">{state.error}</p>}
      {state.details?.map((d) => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
    </div>
  );
}

function PlatformSelect({ name, optional }: { name: string; optional?: boolean }) {
  return (
    <Select name={name} defaultValue={optional ? "none" : "instagram"}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {optional && <SelectItem value="none">من عمود platform في الملف</SelectItem>}
        {SPEND_PLATFORMS.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="size-2 rounded-full" style={{ background: CHANNELS[p].color }} />
            {CHANNELS[p].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ManualSpendForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addSpend, {});
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="date">التاريخ</Label><Input id="date" name="date" type="date" defaultValue={today} dir="ltr" required /></div>
        <div className="grid gap-1.5"><Label>المنصة</Label><PlatformSelect name="platform" /></div>
        <div className="grid gap-1.5"><Label htmlFor="spend">المبلغ</Label><Input id="spend" name="spend" inputMode="decimal" dir="ltr" placeholder="250.00" required /></div>
        <div className="grid gap-1.5">
          <Label>العملة</Label>
          <Select name="currency" defaultValue="SAR">
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="SAR">ريال (SAR)</SelectItem><SelectItem value="USD">دولار (USD)</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="campaign">الحملة (اختياري)</Label><Input id="campaign" name="campaign" dir="ltr" placeholder="ramadan-1" /></div>
        <div className="grid gap-1.5"><Label htmlFor="note">ملاحظة (اختياري)</Label><Input id="note" name="note" /></div>
      </div>
      <div><Button type="submit" disabled={pending}><Plus />{pending ? "جارٍ الحفظ…" : "حفظ الإنفاق"}</Button></div>
      <Result state={state} />
    </form>
  );
}

export function CsvSpendForm({ template }: { template: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(importSpend, {});
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="file">ملف CSV</Label><Input id="file" name="file" type="file" accept=".csv,text/csv" required /></div>
        <div className="grid gap-1.5"><Label>المنصة إن لم يكن في الملف عمود platform</Label><PlatformSelect name="platform" optional /></div>
      </div>
      <p className="text-xs text-muted-foreground">
        الأعمدة المطلوبة: التاريخ والإنفاق. يقبل تصدير Ads Manager مباشرة (مثل Day و Amount spent) إذا اخترت المنصة.
        احفظ الملف بصيغة CSV UTF-8.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}><Upload />{pending ? "جارٍ الاستيراد…" : "استيراد"}</Button>
        <Button
          type="button" variant="outline"
          onClick={() => {
            const url = URL.createObjectURL(new Blob(["﻿" + template], { type: "text/csv" }));
            if (ref.current) { ref.current.href = url; ref.current.click(); }
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download />تحميل القالب
        </Button>
        <a ref={ref} download="spend-template.csv" className="hidden" />
      </div>
      <Result state={state} />
    </form>
  );
}
