import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, motion = "dialog", ...props }) {
  const motionClass = motion === "none" ? "praxis-motion-none" : "praxis-dialog-motion";
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className={cn("praxis-overlay-motion fixed inset-0 z-50 bg-[var(--praxis-overlay-scrim)] backdrop-blur-[2px]", motion === "none" && "praxis-motion-none")}/><DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-panel)] p-6 text-[var(--praxis-text-primary)] shadow-[var(--praxis-shadow-overlay)] focus:outline-none", motionClass, className)} {...props}>{children}<DialogPrimitive.Close aria-label="Close dialog" className="absolute right-4 top-4 rounded p-1 text-[var(--praxis-text-muted)] transition-[color,transform] duration-[var(--praxis-duration-quick)] ease-[var(--praxis-ease-out)] hover:text-[var(--praxis-text-primary)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus)]"><X size={16}/></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;
}

export const DialogTitle = ({ className, ...props }) => <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props}/>;
export const DialogDescription = ({ className, ...props }) => <DialogPrimitive.Description className={cn("mt-2 text-sm leading-6 text-[var(--praxis-text-secondary)]", className)} {...props}/>;
