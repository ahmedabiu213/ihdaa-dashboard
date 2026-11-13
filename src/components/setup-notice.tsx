import { DatabaseZap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SetupNotice() {
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <DatabaseZap className="size-5" />
        </span>
        <h2 className="font-semibold">قاعدة البيانات غير مربوطة بعد</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          أضف المتغير <code dir="ltr" className="rounded bg-muted px-1">DATABASE_URL</code> في إعدادات Vercel ثم أعد النشر.
          ستظهر الأرقام هنا تلقائيًا بعد وصول أول تبرع أو مزامنة إنفاق.
        </p>
      </CardContent>
    </Card>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
