import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger className="text-muted-foreground/70 hover:text-muted-foreground" aria-label="معلومة">
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-pretty">{children}</TooltipContent>
    </Tooltip>
  );
}
