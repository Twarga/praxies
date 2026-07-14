import * as Primitive from "@radix-ui/react-alert-dialog";
import { cn } from "../../lib/cn.js";

export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;
export const AlertDialogCancel = Primitive.Cancel;
export const AlertDialogAction = Primitive.Action;
export function AlertDialogContent({ className, children, ...props }) { return <Primitive.Portal><Primitive.Overlay className="praxis-overlay-motion fixed inset-0 z-50 bg-[var(--praxis-overlay-scrim)]"/><Primitive.Content className={cn("praxis-dialog-motion fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-panel)] p-6 shadow-[var(--praxis-shadow-overlay)]", className)} {...props}>{children}</Primitive.Content></Primitive.Portal>; }
export const AlertDialogTitle = ({ className, ...props }) => <Primitive.Title className={cn("text-lg font-semibold text-[var(--praxis-text-primary)]", className)} {...props}/>;
export const AlertDialogDescription = ({ className, ...props }) => <Primitive.Description className={cn("mt-2 text-sm leading-6 text-[var(--praxis-text-secondary)]", className)} {...props}/>;
