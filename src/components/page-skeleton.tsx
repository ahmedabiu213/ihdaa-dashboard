import { Skeleton } from "@/components/ui/skeleton";

export function SectionsSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="جارٍ التحميل">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function FilterSkeleton() {
  return <Skeleton className="h-8 w-72 rounded-md" />;
}
