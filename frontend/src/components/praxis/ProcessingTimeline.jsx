import { cn } from "../../lib/cn.js";

export function ProcessingTimeline({ steps = [], currentStep, percent = 0, label = "", logs = [] }) {
  return (
    <div className="rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-text-muted)]">
          Processing
        </h3>
        <span className="text-[14px] font-mono text-[var(--praxis-text-primary)] tabular-nums">
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[var(--praxis-bg-canvas)] overflow-hidden mb-4">
        <div className="h-full origin-left rounded-full bg-[var(--praxis-accent)] praxis-progress-bar transition-transform duration-500" style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, percent / 100))})` }} />
      </div>

      {/* Steps */}
      {steps.length ? (
        <div className={`grid gap-2 ${steps.length <= 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {steps.map((step) => {
            const isActive = step.id === currentStep;
            const isDone = step.done;

            return (
              <div
                key={step.id}
                className={cn(
                  "rounded-[var(--praxis-radius-sm)] border px-3 py-2 text-center transition-colors",
                  isActive && "border-[var(--praxis-accent)]/40 bg-[var(--praxis-accent-muted)]",
                  isDone && "border-[var(--praxis-success)]/30 bg-[var(--praxis-success-soft)]",
                  !isActive && !isDone && "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-canvas)]",
                )}
              >
                <div
                  className={cn(
                    "text-[9px] font-mono uppercase tracking-[var(--praxis-tracking-label)]",
                    isActive && "text-[var(--praxis-accent)]",
                    isDone && "text-[var(--praxis-success)]",
                    !isActive && !isDone && "text-[var(--praxis-text-muted)]",
                  )}
                >
                  {step.kicker}
                </div>
                <div
                  className={cn(
                    "mt-0.5 text-[11px] font-medium",
                    isActive && "text-[var(--praxis-text-primary)]",
                    isDone && "text-[var(--praxis-text-secondary)]",
                    !isActive && !isDone && "text-[var(--praxis-text-muted)]",
                  )}
                >
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {label ? (
        <p className="mt-3 text-[11px] text-[var(--praxis-text-secondary)]">{label}</p>
      ) : null}

      {logs.length ? (
        <details className="mt-4 border-t border-[var(--praxis-line-subtle)] pt-3">
          <summary className="cursor-pointer text-xs text-[var(--praxis-text-secondary)]">Processing log</summary>
          <div className="mt-2 max-h-40 overflow-auto rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-bg-canvas)] p-3 font-mono text-[11px] leading-5 text-[var(--praxis-text-muted)]">
            {logs.map((entry, index) => <div key={`${entry.created_at || "log"}-${index}`}>{entry.message || String(entry)}</div>)}
          </div>
        </details>
      ) : null}
    </div>
  );
}
