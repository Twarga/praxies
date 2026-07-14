import { CalendarDays, Flame, ListChecks } from "lucide-react";
import { formatShortDate } from "../../lib/sessionUi.js";

export function ReadinessCard({ streak = 0, weeklyCount = 0, lastSession, nextAssignment }) {
  return (
    <section className="rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4" aria-labelledby="readiness-heading">
      <h2 id="readiness-heading" className="text-sm font-semibold text-[var(--praxis-text-primary)]">Daily readiness</h2>
      <div className="mt-4 flex items-end gap-2"><span className="font-mono text-3xl font-semibold tabular-nums text-[var(--praxis-text-primary)]">{streak}</span><span className="pb-1 text-xs text-[var(--praxis-text-secondary)]">day streak</span><Flame size={16} className="mb-1 ml-auto text-[var(--praxis-warning)]" /></div>
      <dl className="mt-4 divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">
        <div className="flex items-center justify-between gap-3 py-2.5 text-xs"><dt className="inline-flex items-center gap-2 text-[var(--praxis-text-secondary)]"><CalendarDays size={13} /> Last session</dt><dd className="font-mono text-[var(--praxis-text-primary)]">{lastSession ? formatShortDate(lastSession.created_at) : "None"}</dd></div>
        <div className="flex items-center justify-between gap-3 py-2.5 text-xs"><dt className="text-[var(--praxis-text-secondary)]">This week</dt><dd className="font-mono text-[var(--praxis-text-primary)]">{weeklyCount} sessions</dd></div>
      </dl>
      <div className="mt-4 flex gap-2"><ListChecks size={14} className="mt-0.5 shrink-0 text-[var(--praxis-accent)]" /><div><div className="text-[10px] text-[var(--praxis-text-muted)]">Next assignment</div><p className="mt-1 text-xs leading-5 text-[var(--praxis-text-secondary)]">{nextAssignment?.title || nextAssignment?.instructions || "Record a session to generate the next drill."}</p></div></div>
    </section>
  );
}
