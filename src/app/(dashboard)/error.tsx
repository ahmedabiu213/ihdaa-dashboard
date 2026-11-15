"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Shown when a dashboard page fails on the server, instead of an endless loading state. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" />
          </span>
          <h2 className="font-semibold">تعذّر تحميل هذه الصفحة</h2>
          <p className="text-sm text-muted-foreground">حدث خطأ في الخادم. أعد المحاولة، وإن تكرر أرسل الرمز التالي للدعم.</p>
          {error.digest && <code dir="ltr" className="rounded bg-muted px-2 py-1 text-xs">{error.digest}</code>}
          <Button onClick={reset}><RotateCw />إعادة المحاولة</Button>
        </CardContent>
      </Card>
    </div>
  );
}
