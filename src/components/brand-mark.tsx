import { HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)}>
      <HeartHandshake className="size-[60%]" strokeWidth={2} />
    </span>
  );
}
