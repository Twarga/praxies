import { StatusBadge } from "./StatusBadge.jsx";

export function RuntimeHealthRow({ checks = [], onRetest, onAction }) {
  if (!checks.length) {
    return (
      <div className="rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-6 text-center">
        <p className="text-[var(--praxis-text-muted)] text-sm">No diagnostics data available.</p>
        {onRetest ? (
          <button
            onClick={onRetest}
            className="mt-3 text-[11px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-accent)] hover:underline"
          >
            Run Diagnostics
          </button>
        ) : null}
      </div>
    );
  }

  const allOk = checks.every((c) => c.ok);
  const failedCount = checks.filter((c) => !c.ok).length;

  return (
    <div className="rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--praxis-line-subtle)]">
        <div className="flex items-center gap-3">
          <StatusBadge status={allOk ? "ready" : "failed"} />
          <span className="text-[11px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-text-secondary)]">
            {allOk ? "All systems healthy" : `${failedCount} check${failedCount > 1 ? "s" : ""} failed`}
          </span>
        </div>
        {onRetest ? (
          <button
            onClick={onRetest}
            className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-accent)] hover:underline transition-colors"
          >
            Retest
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-[var(--praxis-line-subtle)]">
        {checks.map((check) => (
          <div key={check.name} className="flex items-start justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    check.ok ? "bg-[var(--praxis-success)]" : "bg-[var(--praxis-danger)]"
                  }`}
                />
                <span className="text-[12px] font-medium text-[var(--praxis-text-primary)]">
                  {check.name}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--praxis-text-secondary)]">{check.summary}</p>
              {check.detail ? (
                <p className="mt-0.5 text-[10px] font-mono text-[var(--praxis-text-muted)] truncate max-w-md">
                  {check.detail}
                </p>
              ) : null}
            </div>
            {!check.ok && check.action ? (
              <div className="max-w-[220px] shrink-0 text-right"><p className="text-[10px] leading-relaxed text-[var(--praxis-warning)]">{check.action}</p>{onAction ? <button type="button" onClick={() => onAction(check)} className="mt-2 rounded border border-[var(--praxis-warning)]/30 px-2 py-1 text-[10px] font-medium text-[var(--praxis-warning)] hover:bg-[var(--praxis-warning-soft)]">Change setting</button> : null}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
