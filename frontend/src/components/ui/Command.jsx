import { Command as CommandPrimitive } from "cmdk";
import { cn } from "../../lib/cn.js";
export const Command = ({ className, ...props }) => <CommandPrimitive className={cn("overflow-hidden rounded bg-[var(--praxis-bg-panel)] text-[var(--praxis-text-primary)]", className)} {...props}/>;
export const CommandInput = ({ className, ...props }) => <CommandPrimitive.Input className={cn("h-10 w-full border-b border-[var(--praxis-line-subtle)] bg-transparent px-3 text-sm outline-none placeholder:text-[var(--praxis-text-muted)]", className)} {...props}/>;
export const CommandList = ({ className, ...props }) => <CommandPrimitive.List className={cn("max-h-72 overflow-y-auto p-1", className)} {...props}/>;
export const CommandEmpty = CommandPrimitive.Empty;
export const CommandGroup = CommandPrimitive.Group;
export const CommandItem = ({ className, ...props }) => <CommandPrimitive.Item className={cn("cursor-default rounded px-3 py-2 text-sm data-[selected=true]:bg-[var(--praxis-bg-hover)]", className)} {...props}/>;
