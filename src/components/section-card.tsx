import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({
  title, description, action, children, className, contentClassName,
}: {
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode;
  className?: string; contentClassName?: string;
}) {
  return (
    <Card className={cn("gap-4 shadow-none", className)}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
