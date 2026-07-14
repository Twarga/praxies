import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "../../lib/cn.js";

export function ScrollArea({ className, children, ...props }) {
  return (
    <ScrollAreaPrimitive.Root className={cn("overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="size-full">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex w-2 touch-none select-none p-px">
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--praxis-line-strong)]" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
