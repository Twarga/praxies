import * as Primitive from "@radix-ui/react-popover";
import { cn } from "../../lib/cn.js";
export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export function PopoverContent({ className, sideOffset = 6, ...props }) { return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} className={cn("praxis-pop-motion z-50 w-72 origin-[var(--radix-popover-content-transform-origin)] rounded border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-panel)] p-4 text-[var(--praxis-text-primary)] shadow-[var(--praxis-shadow-overlay)] focus:outline-none", className)} {...props}/></Primitive.Portal>; }
