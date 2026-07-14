import * as Primitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/cn.js";
export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export function DropdownMenuContent({ className, sideOffset = 6, ...props }) { return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} className={cn("praxis-pop-motion z-50 min-w-40 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-panel)] p-1 shadow-[var(--praxis-shadow-overlay)]", className)} {...props}/></Primitive.Portal>; }
export function DropdownMenuItem({ className, ...props }) { return <Primitive.Item className={cn("cursor-default rounded px-3 py-2 text-xs text-[var(--praxis-text-primary)] outline-none data-[highlighted]:bg-[var(--praxis-bg-hover)] data-[disabled]:opacity-40", className)} {...props}/>; }
export const DropdownMenuSeparator = () => <Primitive.Separator className="my-1 h-px bg-[var(--praxis-line-subtle)]"/>;
