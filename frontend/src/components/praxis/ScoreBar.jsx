import { cn } from "../../lib/cn.js";

export function normalizeScore(value, max = 10) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / max : numeric));
}

export function ScoreBar({ label, value, max = 10, className }) {
  const ratio = normalizeScore(value, max);
  const display = Number(value) > 1 ? `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)}/${max}` : `${Math.round(ratio * 100)}%`;
  return (
    <div className={cn("grid grid-cols-[88px_minmax(0,1fr)_42px] items-center gap-3", className)}>
      <span className="text-xs text-[var(--praxis-text-secondary)]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--praxis-bg-elevated)]" role="meter" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Number(value) || 0}>
        <div className="h-full origin-left rounded-full bg-[var(--praxis-accent)] transition-transform duration-500 ease-[var(--praxis-ease-out)]" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <span className="text-right font-mono text-[10px] tabular-nums text-[var(--praxis-text-muted)]">{display}</span>
    </div>
  );
}
