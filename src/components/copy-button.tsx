"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="text-success" /> : <Copy />}
      {done ? "تم النسخ" : label}
    </Button>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="grid gap-2">
      <pre dir="ltr" className="overflow-x-auto rounded-lg border bg-muted/60 p-3 text-start text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <div><CopyButton text={code} /></div>
    </div>
  );
}
