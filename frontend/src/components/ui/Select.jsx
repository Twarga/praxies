import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.js";

export const Select = Primitive.Root;
export function SelectTrigger({ className, children, ...props }) { return <Primitive.Trigger className={cn("inline-flex h-9 min-w-44 items-center justify-between gap-3 rounded border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-canvas)] px-3 text-xs text-[var(--praxis-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus)]", className)} {...props}>{children}<Primitive.Icon><ChevronDown size={14}/></Primitive.Icon></Primitive.Trigger>; }
export const SelectValue = Primitive.Value;
export function SelectContent({ className, children, position = "popper", ...props }) { return <Primitive.Portal><Primitive.Content position={position} className={cn("praxis-pop-motion z-50 min-w-[var(--radix-select-trigger-width)] origin-[var(--radix-select-content-transform-origin)] overflow-hidden rounded border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-panel)] shadow-[var(--praxis-shadow-overlay)]", className)} {...props}><Primitive.Viewport className="p-1">{children}</Primitive.Viewport></Primitive.Content></Primitive.Portal>; }
export function SelectItem({ className, children, ...props }) { return <Primitive.Item className={cn("relative flex cursor-default select-none items-center rounded py-2 pl-8 pr-3 text-xs text-[var(--praxis-text-primary)] outline-none data-[highlighted]:bg-[var(--praxis-bg-hover)] data-[disabled]:opacity-40", className)} {...props}><span className="absolute left-2"><Primitive.ItemIndicator><Check size={14}/></Primitive.ItemIndicator></span><Primitive.ItemText>{children}</Primitive.ItemText></Primitive.Item>; }
