import { Activity, ArrowRight, Mic } from "lucide-react";
import { formatDuration, formatShortDate, getSessionTitle, getStatusLabel } from "../../lib/sessionUi.js";
import { ReadinessCard } from "./ReadinessCard.jsx";
import { getSessionThumbnailUrl } from "../../api/sessions.js";
import { CurrentGoal } from "./CurrentGoal.jsx";

export function TodayWorkspace({
  practice,
  sessions,
  processing,
  needsAttention,
  streak,
  weeklyCount,
  weeklyMinutes,
  digestHeadline,
  digestActions,
  onNavigate,
}) {
  const recent = sessions.slice(0, 3);
  const goal = practice?.active_goal;
  const assignment = practice?.current_assignment;

  return (
    <div className="h-full overflow-y-auto bg-[var(--praxis-bg-canvas)]">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[var(--praxis-line-subtle)] bg-[var(--praxis-glass-reading)] px-6 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Today</h1>
          <p className="mt-0.5 text-[11px] text-[var(--praxis-text-muted)]">Continue the next step in your practice loop.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("record")}
          className="inline-flex h-8 items-center gap-2 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]"
        >
          <Mic size={14} /> Record journal
        </button>
      </header>

      <main
        className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]"
        data-layout="command-desk"
      >
        <div className="min-w-0 space-y-6">
          <CurrentGoal
            goal={goal}
            assignment={assignment}
            evidence={assignment?.instructions}
            onStartPractice={() => onNavigate("practice")}
            onRecord={() => onNavigate("record")}
          />

          {digestHeadline || digestActions?.length ? (
            <section className="border-y border-[var(--praxis-line-subtle)] py-5">
              <h2 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Latest lesson</h2>
              {digestHeadline ? <p className="mt-3 max-w-[65ch] text-sm leading-6 text-[var(--praxis-text-primary)]">{digestHeadline}</p> : null}
              {digestActions?.length ? <div className="mt-4 divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">{digestActions.map((action) => <div key={action} className="py-2.5 text-sm leading-6 text-[var(--praxis-text-secondary)]">{action}</div>)}</div> : null}
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Recent loop</h2>
              <button type="button" onClick={() => onNavigate("gallery")} className="inline-flex items-center gap-1 text-xs text-[var(--praxis-accent)]">View sessions <ArrowRight size={13} /></button>
            </div>
            <div className="divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">
              {recent.map((session) => <button key={session.id} type="button" onClick={() => onNavigate("session", { sessionId: session.id })} className="flex w-full items-center gap-3 py-3 text-left hover:bg-[var(--praxis-bg-hover)]"><img src={getSessionThumbnailUrl(session.id)} alt="" className="h-[27px] w-12 shrink-0 rounded-[3px] bg-[var(--praxis-bg-elevated)] object-cover" /><span className={"h-2 w-2 rounded-full " + (session.status === "ready" || session.status === "done" ? "bg-[var(--praxis-success)]" : session.status === "failed" || session.status === "needs_attention" ? "bg-[var(--praxis-danger)]" : "bg-[var(--praxis-warning)]")} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-[var(--praxis-text-primary)]">{getSessionTitle(session)}</div><div className="mt-1 text-[11px] text-[var(--praxis-text-muted)]">{formatShortDate(session.created_at)} · {formatDuration(session.duration_seconds)} · {getStatusLabel(session.status)}</div>{session.finding ? <p className="mt-1 truncate text-xs text-[var(--praxis-text-secondary)]">{session.finding}</p> : null}</div><ArrowRight size={15} className="text-[var(--praxis-text-muted)]" /></button>)}
              {!recent.length ? <div className="flex items-center justify-between gap-4 py-6"><span className="text-sm text-[var(--praxis-text-muted)]">No sessions yet.</span><button type="button" onClick={() => onNavigate("record")} className="rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent)] px-3 py-2 text-xs font-semibold text-[var(--praxis-on-accent)]">Record your first session</button></div> : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <ReadinessCard streak={streak?.current || 0} weeklyCount={weeklyCount || 0} lastSession={recent[0]} nextAssignment={assignment} />
          <section className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Processing</h2><Activity size={15} className={processing.length ? "text-[var(--praxis-accent)]" : "text-[var(--praxis-text-muted)]"} /></div>
            {processing.length || needsAttention.length ? <div className="mt-3 space-y-2">{[...processing, ...needsAttention].slice(0, 3).map((session) => <button key={session.id} type="button" onClick={() => onNavigate("session", { sessionId: session.id })} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--praxis-bg-hover)]"><span className={"h-1.5 w-1.5 rounded-full " + (needsAttention.some((item) => item.id === session.id) ? "bg-[var(--praxis-danger)]" : "bg-[var(--praxis-accent)]")} /><span className="min-w-0 flex-1 truncate text-xs text-[var(--praxis-text-secondary)]">{getSessionTitle(session)}</span></button>)}</div> : <p className="mt-3 text-xs leading-5 text-[var(--praxis-text-muted)]">No active tasks. Your local workspace is up to date.</p>}
          </section>
        </aside>
      </main>
    </div>
  );
}
