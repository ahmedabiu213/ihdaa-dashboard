"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHANNELS } from "@/lib/channels";
import { UTM_PRESETS, buildUtmUrl, toCode, utmParams, type UtmInput } from "@/lib/utm";
import { saveUtmLink } from "./actions";

type Product = { id: number; name: string };

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button" size="sm" variant="outline" disabled={!value}
          onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? "تم النسخ" : "نسخ"}
        </Button>
      </div>
      <div dir="ltr" className="min-h-10 rounded-lg border bg-muted/50 p-3 text-start font-mono text-xs break-all">
        {value || "—"}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function UtmBuilder({ products, storeUrl }: { products: Product[]; storeUrl: string }) {
  const [platform, setPlatform] = useState<UtmInput["platform"]>("snapchat");
  const [url, setUrl] = useState(storeUrl);
  const [productId, setProductId] = useState<string>("none");
  const [term, setTerm] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const preset = UTM_PRESETS[platform];

  const project = productId !== "none" ? `p-${productId}` : toCode(term);
  const urlValid = /^https?:\/\/[^\s]+\.[^\s]+/.test(url.trim());
  const ready = urlValid && !!project && (preset.campaign != null || !!toCode(campaign));

  const { full, params } = useMemo(() => {
    if (!ready) return { full: "", params: "" };
    const input: UtmInput = { platform, url, term: project, campaign, content };
    try { return { full: buildUtmUrl(input), params: utmParams(input) }; } catch { return { full: "", params: "" }; }
  }, [ready, platform, url, project, campaign, content]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <div className="grid gap-1.5">
          <Label>المنصة</Label>
          <Select value={platform} onValueChange={(v) => { setPlatform(v as UtmInput["platform"]); setSaved(false); }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(UTM_PRESETS).map(([k, p]) => (
                <SelectItem key={k} value={k}>
                  <span className="size-2 rounded-full" style={{ background: CHANNELS[p.channel].color }} />
                  {CHANNELS[p.channel].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="url">رابط الصفحة في المتجر</Label>
          <Input id="url" dir="ltr" value={url} onChange={(e) => { setUrl(e.target.value); setSaved(false); }} placeholder="https://store-ihdaa.org.sa/ar/..." />
          {!urlValid && url && <p className="text-xs text-destructive">الرابط يجب أن يبدأ بـ https://</p>}
        </div>
        <div className="grid gap-1.5">
          <Label>المشروع</Label>
          <Select value={productId} onValueChange={(v) => { setProductId(v); setSaved(false); }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">اكتب رمزًا يدويًا</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {productId === "none" && (
            <Input dir="ltr" value={term} onChange={(e) => { setTerm(e.target.value); setSaved(false); }} placeholder="water-project" />
          )}
          <p className="text-xs text-muted-foreground">
            {products.length === 0
              ? "تظهر المشاريع هنا تلقائيًا بعد وصول أول تبرع لكل مشروع. حتى ذلك الحين اكتب رمزًا قصيرًا بالإنجليزية."
              : "يُحفظ المشروع في utm_term لربط التبرعات والإنفاق بكل مشروع."}
          </p>
        </div>
        {preset.campaign == null && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="campaign">اسم الحملة</Label>
              <Input id="campaign" dir="ltr" value={campaign} onChange={(e) => { setCampaign(e.target.value); setSaved(false); }} placeholder="ramadan-1" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="content">الرسالة (اختياري)</Label>
              <Input id="content" dir="ltr" value={content} onChange={(e) => { setContent(e.target.value); setSaved(false); }} placeholder="msg-a" />
            </div>
          </div>
        )}
      </div>

      <div className="grid content-start gap-4">
        <CopyField label="الرابط الكامل" value={full} hint={preset.note} />
        {preset.paramsField && <CopyField label={`المعاملات فقط (${preset.paramsField})`} value={params} />}
        <div>
          <Button
            type="button" disabled={!full || pending || saved}
            onClick={() => start(async () => {
              await saveUtmLink({ platform, url: full, label: preset.campaign == null ? toCode(campaign) : null, productId: productId !== "none" ? Number(productId) : null });
              setSaved(true);
            })}
          >
            {saved ? <Check /> : <Save />}
            {saved ? "تم الحفظ" : "حفظ في السجل"}
          </Button>
        </div>
      </div>
    </div>
  );
}
