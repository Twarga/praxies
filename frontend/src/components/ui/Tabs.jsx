import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn.js";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }) {
  return <TabsPrimitive.List className={cn("flex border-b border-[var(--praxis-line-subtle)]", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "min-h-11 flex-1 border-b-2 border-transparent px-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--praxis-text-muted)] transition-[border-color,color,transform] duration-[var(--praxis-duration-quick)] ease-[var(--praxis-ease-out)] active:scale-[0.97] hover:text-[var(--praxis-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--praxis-focus)] data-[state=active]:border-[var(--praxis-text-primary)] data-[state=active]:text-[var(--praxis-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content className={cn("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus)]", className)} {...props} />;
}
