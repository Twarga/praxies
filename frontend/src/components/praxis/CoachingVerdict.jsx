import { Button } from "../ui/Button.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

export function CoachingVerdict({ verdict, headline, strength, improvement, practice, nextGoal }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Verdict */}
      <div className="rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full bg-[var(--praxis-accent)]" />
          <h3 className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-text-muted)]">
            Coaching Verdict
          </h3>
        </div>
        <p className="text-[var(--praxis-text-primary)] text-base leading-[var(--praxis-leading-relaxed)] max-w-[65ch]">
          {verdict || headline || "No verdict available."}
        </p>
      </div>

      {/* Strength */}
      {strength?.title ? (
        <div className="rounded-[var(--praxis-radius-md)] border-l-2 border-[var(--praxis-success)] bg-[var(--praxis-bg-panel)] p-4 pl-5">
          <h4 className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-success)] mb-1">
            Strength
          </h4>
          <p className="text-[var(--praxis-text-primary)] text-sm font-medium">{strength.title}</p>
          {strength.explanation ? (
            <p className="mt-2 text-[var(--praxis-text-secondary)] text-sm leading-[var(--praxis-leading-relaxed)]">
              {strength.explanation}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Priority Improvement */}
      {improvement?.title ? (
        <div className="rounded-[var(--praxis-radius-md)] border-l-2 border-[var(--praxis-warning)] bg-[var(--praxis-bg-panel)] p-4 pl-5">
          <h4 className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-warning)] mb-1">
            Priority Improvement
          </h4>
          <p className="text-[var(--praxis-text-primary)] text-sm font-medium">{improvement.title}</p>
          {improvement.explanation ? (
            <p className="mt-2 text-[var(--praxis-text-secondary)] text-sm leading-[var(--praxis-leading-relaxed)]">
              {improvement.explanation}
            </p>
          ) : null}
          {improvement.replacement_behavior ? (
            <p className="mt-2 text-[var(--praxis-accent)] text-sm italic">
              {improvement.replacement_behavior}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Practice */}
      {practice?.title ? (
        <div className="rounded-[var(--praxis-radius-md)] border border-[var(--praxis-accent)]/25 bg-[var(--praxis-accent-muted)] p-5">
          <h4 className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-accent)] mb-3">
            Practice Exercise
          </h4>
          <p className="text-[var(--praxis-text-primary)] text-sm font-medium">{practice.title}</p>
          {practice.instructions ? (
            <p className="mt-2 text-[var(--praxis-text-secondary)] text-sm leading-[var(--praxis-leading-relaxed)]">
              {practice.instructions}
            </p>
          ) : null}
          {practice.success_criteria?.length ? (
            <ul className="mt-3 space-y-1">
              {practice.success_criteria.map((criterion, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-[var(--praxis-text-secondary)]">
                  <span className="text-[var(--praxis-success)] mt-1">•</span>
                  {criterion}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Next Goal */}
      {nextGoal?.text ? (
        <div className="flex items-center justify-between rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-4">
          <div className="min-w-0">
            <h4 className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-text-muted)] mb-1">
              Next Goal
            </h4>
            <p className="text-[var(--praxis-text-primary)] text-sm truncate">{nextGoal.text}</p>
          </div>
          <span className="shrink-0 text-[10px] font-mono text-[var(--praxis-accent)]">
            {nextGoal.success_criteria?.length || 0} criteria
          </span>
        </div>
      ) : null}
    </div>
  );
}
