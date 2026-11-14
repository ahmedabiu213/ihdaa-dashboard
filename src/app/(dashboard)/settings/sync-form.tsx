"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { syncNow, type ActionState } from "./actions";

export function SyncForm({ platform }: { platform: "snapchat" | "tiktok" }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(syncNow, {});
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="platform" value={platform} />
      <div className="flex flex-wrap items-center gap-2">
        <Select name="days" defaultValue="7">
          <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">آخر 3 أيام</SelectItem>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="90">آخر 90 يوم</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={pending}>
          <RefreshCw className={pending ? "animate-spin" : undefined} />
          {pending ? "جارٍ المزامنة…" : "مزامنة الآن"}
        </Button>
      </div>
      {state.ok && <p className="text-sm text-success">{state.ok}</p>}
      {state.error && <p className="text-sm break-words text-destructive" dir="auto">{state.error}</p>}
    </form>
  );
}
