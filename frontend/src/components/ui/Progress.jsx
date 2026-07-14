import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../../lib/cn.js";

export function Progress({ value = 0, className, indicatorClassName, ...props }) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <ProgressPrimitive.Root
      className={cn("relative h-1.5 overflow-hidden rounded-full bg-[var(--praxis-bg-elevated)]", className)}
      value={normalized}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full bg-[var(--praxis-accent)] transition-transform", indicatorClassName)}
        style={{ transform: `scaleX(${normalized / 100})`, transformOrigin: "left center" }}
      />
    </ProgressPrimitive.Root>
  );
}
