"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LevelTabs({ options }: { options: Array<{ value: string; label: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get("level") ?? options[0].value;
  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        const next = new URLSearchParams(params);
        if (v === options[0].value) next.delete("level"); else next.set("level", v);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      <TabsList>
        {options.map((o) => <TabsTrigger key={o.value} value={o.value}>{o.label}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  );
}
