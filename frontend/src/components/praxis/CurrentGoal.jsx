import { Mic, Play } from "lucide-react";

export function CurrentGoal({
  goal,
  assignment,
  evidence,
  onStartPractice,
  onRecord,
  onComplete,
}) {
  if (!goal?.text) {
    return (
      <section className="praxis-panel p-5" aria-labelledby="current-goal-title">
        <h2 id="current-goal-title" className="text-xl font-semibold text-[var(--praxis-text-primary)]">
          Record a baseline session to set your first goal.
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[var(--praxis-text-secondary)]">
          Your first report will turn one evidence-backed correction into a measurable target.
        </p>
        {onRecord ? (
          <button type="button" onClick={onRecord} className="mt-4 inline-flex h-8 items-center gap-2 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-record)] px-3 text-xs font-semibold text-[var(--praxis-on-record)]">
            <Mic size={14} /> Record journal
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="praxis-panel border-[var(--praxis-accent)]/30 bg-[var(--praxis-accent-muted)] p-5" aria-labelledby="current-goal-title">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-[var(--praxis-accent)]">Current goal</div>
          <h2 id="current-goal-title" className="mt-2 max-w-[58ch] text-xl font-semibold leading-7 text-[var(--praxis-text-primary)]">
            {goal.text}
          </h2>
          {goal.success_criteria?.length ? (
            <ul className="mt-3 space-y-1.5">
              {goal.success_criteria.map((criterion) => (
                <li key={criterion} className="flex items-start gap-2 text-sm text-[var(--praxis-text-secondary)]">
                  <span className="mt-1 text-[var(--praxis-success)]" aria-hidden="true">•</span>
                  {criterion}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-accent)]">
          {goal.status || "active"}
        </span>
      </div>

      {evidence || assignment?.instructions ? (
        <div className="mt-4 border-l-2 border-[var(--praxis-accent)] pl-3 text-sm leading-6 text-[var(--praxis-text-secondary)]" data-goal-evidence="true">
          {evidence || assignment.instructions}
        </div>
      ) : null}

      {onStartPractice || onRecord ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {onStartPractice && assignment ? (
            <button type="button" onClick={onStartPractice} className="inline-flex h-8 items-center gap-2 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]" data-primary-cta="true">
              <Play size={14} /> Start practice
            </button>
          ) : null}
          {onRecord ? (
            <button type="button" onClick={onRecord} className="inline-flex h-8 items-center gap-2 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 text-xs font-medium text-[var(--praxis-text-primary)]">
              <Mic size={14} /> Record journal
            </button>
          ) : null}
        </div>
      ) : null}

      {assignment && onComplete ? (
        <button type="button" onClick={onComplete} className="mt-4 text-xs text-[var(--praxis-accent)]">
          Mark exercise complete
        </button>
      ) : null}
    </section>
  );
}
