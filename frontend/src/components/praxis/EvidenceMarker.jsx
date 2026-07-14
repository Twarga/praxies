import { cn } from "../../lib/cn.js";

export function EvidenceMarker({ timestamp, duration, kind = "strength", label, onSeek }) {
  const safeDuration = Math.max(1, Number(duration) || 1);
  const seconds = Math.max(0, Math.min(safeDuration, Number(timestamp) || 0));
  const left = (seconds / safeDuration) * 100;
  return (
    <button
      type="button"
      aria-label={label || `Evidence at ${Math.floor(seconds)} seconds`}
      onClick={(event) => { event.stopPropagation(); onSeek?.(seconds); }}
      className={cn("absolute inset-y-0 z-10 w-2 -translate-x-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus)]", kind === "filler" ? "text-[var(--praxis-warning)]" : "text-[var(--praxis-success)]")}
      style={{ left: `${left}%` }}
    >
      <span className="mx-auto block h-full w-px bg-current" />
    </button>
  );
}
