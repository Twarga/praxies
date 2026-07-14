import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { completePracticeAssignment, createPracticeGoal, getPracticeCurrent, getPracticeHistory } from "../api/practice.js";
import { CurrentGoal } from "../components/praxis/CurrentGoal.jsx";
import { useToast } from "../hooks/useToast.js";

const DRILL_SECONDS = 180;

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function Practice({ onNavigate, scrollRef }) {
  const { pushToast } = useToast();
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drillState, setDrillState] = useState("idle");
  const [remaining, setRemaining] = useState(DRILL_SECONDS);
  const [note, setNote] = useState("");
  const [completion, setCompletion] = useState(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalCategory, setGoalCategory] = useState("journal");
  const [addingGoal, setAddingGoal] = useState(false);

  async function refresh() {
    const [currentPayload, historyPayload] = await Promise.all([getPracticeCurrent(), getPracticeHistory()]);
    setCurrent(currentPayload);
    setHistory(Array.isArray(historyPayload?.assignments) ? historyPayload.assignments : []);
  }

  useEffect(() => {
    void refresh().catch((error) => pushToast({ kind: "error", message: error instanceof Error ? error.message : "Practice data unavailable." })).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (drillState !== "active") return undefined;
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setDrillState("review");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [drillState]);

  const assignment = current?.current_assignment;
  const progress = useMemo(() => Math.max(0, Math.min(100, ((DRILL_SECONDS - remaining) / DRILL_SECONDS) * 100)), [remaining]);

  function beginDrill() {
    setRemaining(DRILL_SECONDS);
    setNote("");
    setCompletion(null);
    setDrillState("active");
  }

  async function complete(outcome) {
    const assignmentId = assignment?.assignment_id;
    setCompletion(outcome);
    setDrillState("complete");
    window.localStorage.setItem("praxis.practice.last-outcome", JSON.stringify({ assignmentId, outcome, note, completedAt: new Date().toISOString() }));
    if (outcome !== "done" || !assignmentId) {
      pushToast({ kind: "info", message: outcome === "hard" ? "Marked hard. Keep the same focus for your next take." : "Saved for later. Your active goal remains available." });
      return;
    }
    try {
      await completePracticeAssignment(assignmentId);
      await refresh();
      pushToast({ kind: "success", message: "Exercise completed." });
    } catch (error) {
      pushToast({ kind: "error", message: error instanceof Error ? error.message : "Could not complete exercise." });
    }
  }

  async function addGoal(event) {
    event.preventDefault();
    const text = goalDraft.trim();
    if (text.length < 3) return;
    setAddingGoal(true);
    try {
      await createPracticeGoal({ text, category: goalCategory });
      setGoalDraft("");
      await refresh();
      pushToast({ kind: "success", message: "Goal added. It will stay active beside your other tracks." });
    } catch (error) {
      pushToast({ kind: "error", message: error instanceof Error ? error.message : "Could not add goal." });
    } finally { setAddingGoal(false); }
  }

  const isDrilling = drillState === "active" || drillState === "paused";

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-[var(--praxis-bg-canvas)]">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[var(--praxis-line-subtle)] bg-[var(--praxis-glass-reading)] px-6 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Practice</h1>
          <p className="mt-0.5 text-[11px] text-[var(--praxis-text-muted)]">One focused drill before your next journal.</p>
        </div>
        <button type="button" onClick={() => onNavigate("record")} className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]"><Mic size={14} /> New journal</button>
      </header>
      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-6 py-8">
        {loading ? <div className="space-y-4"><div className="praxis-shimmer h-28 rounded-lg" /><div className="praxis-shimmer h-56 rounded-lg" /></div> : (
          <>
            <div className="min-w-0 space-y-8">
              <CurrentGoal goal={current?.active_goal} assignment={assignment} />
              <section className="border-b border-[var(--praxis-line-subtle)] pb-5">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Other active tracks</h2><span className="text-[11px] text-[var(--praxis-text-muted)]">Language, journal, or any focus you choose</span></div>
                <div className="mt-3 space-y-2">{(current?.active_goals || []).filter((goal) => goal.goal_id !== current?.active_goal?.goal_id).map((goal) => <div key={goal.goal_id} className="flex items-start gap-3 py-1.5"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--praxis-accent)]" /><div><span className="mr-2 font-mono text-[10px] uppercase text-[var(--praxis-text-muted)]">{goal.category}</span><span className="text-sm text-[var(--praxis-text-primary)]">{goal.text}</span></div></div>)}</div>
                <form onSubmit={addGoal} className="mt-4 flex flex-wrap items-center gap-2"><select value={goalCategory} onChange={(event) => setGoalCategory(event.target.value)} className="h-8 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-2 text-xs text-[var(--praxis-text-primary)]"><option value="journal">Journal</option><option value="language">Language</option><option value="speaking">Speaking</option><option value="project">Project</option></select><input value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} maxLength={240} placeholder="Add another goal…" className="h-8 min-w-[240px] flex-1 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-3 text-xs text-[var(--praxis-text-primary)] placeholder:text-[var(--praxis-text-muted)]" /><button type="submit" disabled={addingGoal || goalDraft.trim().length < 3} className="h-8 rounded-md border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40">{addingGoal ? "Adding…" : "Add goal"}</button></form>
              </section>
              {assignment ? (
                <section className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-[var(--praxis-accent)]">Current exercise</div>
                      <h2 className="mt-2 text-base font-semibold text-[var(--praxis-text-primary)]">{assignment.title || "Practice exercise"}</h2>
                      <p className="mt-3 max-w-[65ch] text-sm leading-6 text-[var(--praxis-text-secondary)]">{assignment.instructions || "Follow the next coaching instruction in your own words."}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-[var(--praxis-text-muted)]"><Clock3 size={14} /> 03:00</span>
                  </div>

                  {isDrilling || drillState === "review" ? (
                    <div className="mt-5 border-y border-[var(--praxis-line-subtle)] py-4">
                      <div className="flex items-center justify-between gap-4"><div><div className="font-mono text-5xl tabular-nums text-[var(--praxis-text-primary)]">{formatTime(remaining)}</div><p className="mt-1 text-xs text-[var(--praxis-text-muted)]">{drillState === "paused" ? "Drill paused" : remaining === 0 ? "Time is up — reflect on the attempt." : "Stay with one idea at a time."}</p></div><div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--praxis-bg-elevated)]"><div className="h-full origin-left bg-[var(--praxis-accent)] transition-transform duration-150" style={{ transform: `scaleX(${progress / 100})` }} /></div></div>
                      <textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} placeholder="Optional note: what felt difficult or improved?" className="mt-4 min-h-20 w-full rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] p-3 text-sm text-[var(--praxis-text-primary)] outline-none placeholder:text-[var(--praxis-text-muted)] focus:border-[var(--praxis-accent)]" />
                      <div className="mt-4 flex flex-wrap gap-2">
                        {drillState === "active" ? <button type="button" onClick={() => setDrillState("paused")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 text-xs text-[var(--praxis-text-primary)]"><Pause size={14} /> Pause</button> : null}
                        {drillState === "paused" ? <button type="button" onClick={() => setDrillState("active")} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]"><Play size={14} /> Resume</button> : null}
                        {isDrilling ? <button type="button" onClick={() => setDrillState("review")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-secondary)]"><Square size={13} /> End drill</button> : null}
                        {isDrilling ? <button type="button" onClick={beginDrill} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-secondary)]"><RotateCcw size={13} /> Reset</button> : null}
                      </div>
                    </div>
                  ) : null}

                  {drillState === "idle" ? <div className="mt-5 border-t border-[var(--praxis-line-subtle)] pt-4"><button type="button" onClick={beginDrill} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]"><Play size={14} /> Start drill</button></div> : null}
                  {drillState === "review" ? <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void complete("done")} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--praxis-success)] px-3 text-xs font-semibold text-[var(--praxis-on-success)]"><CheckCircle2 size={14} /> Done</button><button type="button" onClick={() => void complete("hard")} className="h-8 rounded-md border border-[var(--praxis-warning)]/40 bg-[var(--praxis-warning-soft)] px-3 text-xs text-[var(--praxis-warning)]">Too hard</button><button type="button" onClick={() => void complete("later")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 text-xs text-[var(--praxis-text-secondary)]"><RotateCcw size={14} /> Repeat later</button></div> : null}
                  {drillState === "complete" ? <p className="mt-5 border-t border-[var(--praxis-line-subtle)] pt-4 text-sm text-[var(--praxis-text-secondary)]">{completion === "done" ? "Practice saved. Record again when you are ready to test this focus with new evidence." : "Your outcome is saved locally. Return when you are ready."}</p> : null}
                </section>
              ) : (
                <section className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-6 text-center"><h2 className="text-base font-semibold text-[var(--praxis-text-primary)]">Your first report creates the first drill.</h2><p className="mx-auto mt-2 max-w-[55ch] text-sm leading-6 text-[var(--praxis-text-secondary)]">Record a journal session, then Praxis will choose one specific target with evidence to practice here.</p><button type="button" onClick={() => onNavigate("record")} className="mt-5 inline-flex h-8 items-center gap-2 rounded-md bg-[var(--praxis-record)] px-3 text-xs font-semibold text-[var(--praxis-on-record)]"><Mic size={14} /> Record journal</button></section>
              )}
              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Previous exercises</h2><span className="text-[11px] text-[var(--praxis-text-muted)]">{history.length} total</span></div>
                <div className="divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">{[...history].reverse().map((item) => <div key={item.assignment_id} className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><div className="text-sm text-[var(--praxis-text-primary)]">{item.title || "Practice exercise"}</div><p className="mt-1 max-w-[65ch] text-xs leading-5 text-[var(--praxis-text-secondary)]">{item.instructions}</p>{item.source_session_id ? <button type="button" onClick={() => onNavigate("session", { sessionId: item.source_session_id })} className="mt-2 text-[11px] text-[var(--praxis-accent)]">Open source session</button> : null}</div>{item.completed ? <CheckCircle2 size={16} className="mt-1 shrink-0 text-[var(--praxis-success)]" /> : <span className="mt-1 text-[10px] text-[var(--praxis-warning)]">Due</span>}</div>)}{!history.length ? <div className="py-8 text-center text-sm text-[var(--praxis-text-muted)]">No completed exercises yet.</div> : null}</div>
              </section>
            </div>
            <aside className="h-fit rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4"><h2 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Practice context</h2><p className="mt-2 text-xs leading-5 text-[var(--praxis-text-secondary)]">Complete one attempt. Then record again so Praxis can test the same target with new evidence.</p>{current?.active_goal?.success_criteria?.length ? <ul className="mt-4 space-y-2 border-t border-[var(--praxis-line-subtle)] pt-4">{current.active_goal.success_criteria.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-[var(--praxis-text-secondary)]"><span className="text-[var(--praxis-success)]">•</span>{item}</li>)}</ul> : null}</aside>
          </>
        )}
      </main>
    </div>
  );
}
