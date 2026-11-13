import { Hammer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/page-header";
import { ALL_NAV } from "@/components/nav";

/** Placeholder for a page whose route exists but whose content is the next step. */
export function ComingSoon({ href, planned }: { href: string; planned: string[] }) {
  const item = ALL_NAV.find((n) => n.href === href);
  return (
    <>
      <PageHeader title={item?.label ?? ""} description={item?.description} />
      <PageBody>
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Hammer className="size-5" />
            </span>
            <h2 className="font-semibold">هذه الصفحة قيد البناء</h2>
            <ul className="grid gap-1 text-sm text-muted-foreground">
              {planned.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
