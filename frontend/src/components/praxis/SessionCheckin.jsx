import { useState } from "react";
import { Check } from "lucide-react";
import { saveDogfoodCheckin } from "../../api/dogfood.js";

function Choice({ value, onChange, children }) {
  return <div className="flex items-center justify-between gap-3 py-2"><span className="text-xs text-[var(--praxis-text-secondary)]">{children}</span><div className="flex gap-1">{[[true, "Yes"], [false, "No"]].map(([answer, label]) => <button key={label} type="button" onClick={() => onChange(answer)} className={`rounded px-2.5 py-1 text-[10px] ${value === answer ? "bg-[var(--praxis-accent)] text-[var(--praxis-on-accent)]" : "border border-[var(--praxis-line-subtle)] text-[var(--praxis-text-muted)]"}`}>{label}</button>)}</div></div>;
}

export function SessionCheckin({ sessionId, pushToast }) {
  const [answers, setAnswers] = useState({ understandable: null, correction_accurate: null, will_practice: null, friction_notes: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  if (saved) return <div className="flex items-center gap-2 rounded-lg border border-[var(--praxis-success)]/30 bg-[var(--praxis-success)]/10 px-4 py-3 text-xs text-[var(--praxis-success)]"><Check size={14} /> Feedback saved locally. Thank you.</div>;
  async function submit() {
    setSaving(true);
    try { await saveDogfoodCheckin({ session_id: sessionId, ...answers }); setSaved(true); }
    catch (error) { pushToast?.({ kind: "error", message: error instanceof Error ? error.message : "Could not save feedback." }); }
    finally { setSaving(false); }
  }
  return <section className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-medium text-[var(--praxis-text-primary)]">Was this coaching useful?</h3><p className="mt-1 text-[11px] text-[var(--praxis-text-muted)]">A 20-second check-in. Stored only inside your journal.</p></div><span className="text-[10px] text-[var(--praxis-text-muted)]">Optional</span></div><div className="mt-3 divide-y divide-[var(--praxis-line-subtle)]"><Choice value={answers.understandable} onChange={(value) => setAnswers((a) => ({ ...a, understandable: value }))}>Report easy to understand?</Choice><Choice value={answers.correction_accurate} onChange={(value) => setAnswers((a) => ({ ...a, correction_accurate: value }))}>Main correction accurate?</Choice><Choice value={answers.will_practice} onChange={(value) => setAnswers((a) => ({ ...a, will_practice: value }))}>Will you try the exercise?</Choice></div><textarea value={answers.friction_notes} onChange={(event) => setAnswers((a) => ({ ...a, friction_notes: event.target.value.slice(0, 500) }))} placeholder="What felt slow, confusing, or broken?" className="mt-3 min-h-20 w-full resize-y rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-canvas)] p-3 text-xs text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-accent)]"/><div className="mt-3 flex justify-end"><button type="button" onClick={() => void submit()} disabled={saving} className="rounded bg-[var(--praxis-accent)] px-4 py-2 text-xs font-medium text-[var(--praxis-on-accent)] disabled:opacity-50">{saving ? "Saving…" : "Save check-in"}</button></div></section>;
}
