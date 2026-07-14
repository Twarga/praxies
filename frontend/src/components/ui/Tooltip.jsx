import * as Primitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/cn.js";
export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;
export function TooltipContent({ className, sideOffset = 6, ...props }) { return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} className={cn("praxis-pop-motion z-50 origin-[var(--radix-tooltip-content-transform-origin)] rounded border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--praxis-text-primary)] shadow-[var(--praxis-shadow-overlay)]", className)} {...props}/></Primitive.Portal>; }
