"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays, Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_PRESETS, DEFAULT_PRESET } from "@/lib/dates";
import { CHANNELS, CHANNEL_KEYS } from "@/lib/channels";

/** Date range + channel filters, kept in the URL so views are shareable. */
export function FilterBar({ showChannel = true }: { showChannel?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value == null) next.delete(key);
    else next.set(key, value);
    if (key === "range") { next.delete("from"); next.delete("to"); }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const range = params.get("from") ? "custom" : (params.get("range") ?? DEFAULT_PRESET);

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={pending || undefined}>
      <Select value={range} onValueChange={(v) => set("range", v)}>
        <SelectTrigger size="sm" className="min-w-36 bg-card">
          <CalendarDays className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(RANGE_PRESETS).map(([k, label]) => (
            <SelectItem key={k} value={k}>{label}</SelectItem>
          ))}
          {range === "custom" && <SelectItem value="custom" disabled>فترة مخصصة</SelectItem>}
        </SelectContent>
      </Select>
      {showChannel && (
        <Select value={params.get("channel") ?? "all"} onValueChange={(v) => set("channel", v === "all" ? null : v)}>
          <SelectTrigger size="sm" className="min-w-36 bg-card">
            <Share2 className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل القنوات</SelectItem>
            {CHANNEL_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                <span className="size-2 rounded-full" style={{ background: CHANNELS[k].color }} />
                {CHANNELS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
