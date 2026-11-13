import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
      <SidebarTrigger className="-ms-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="min-w-0 flex-1 basis-40">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">{actions}</div>}
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid w-full max-w-7xl gap-4 p-4 md:p-6">{children}</div>;
}
