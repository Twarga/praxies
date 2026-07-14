import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/cn.js";

export function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root
      role="switch"
      className={cn("group inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-[var(--praxis-line-strong)] bg-[var(--praxis-bg-elevated)] p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus)] data-[state=checked]:border-[var(--praxis-accent)] data-[state=checked]:bg-[var(--praxis-accent-soft)] disabled:opacity-40", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-[var(--praxis-text-muted)] transition-transform group-data-[state=checked]:translate-x-5 group-data-[state=checked]:bg-[var(--praxis-accent)]" />
    </SwitchPrimitive.Root>
  );
}
