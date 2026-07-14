import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { getDogfoodWeeklySummary } from "../../api/dogfood.js";

export function DogfoodSummary({ pushToast }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  async function refresh() {
    setLoading(true);
    try { setSummary(await getDogfoodWeeklySummary()); }
    catch (error) { pushToast?.({ kind: "error", message: error instanceof Error ? error.message : "Could not load trial summary." }); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  function exportSummary() {
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `praxis-trial-summary-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-semibold text-[var(--praxis-text-primary)]">30-day trial feedback</h3><p className="mt-1 text-xs text-[var(--praxis-text-secondary)]">Local usage signals and your post-report check-ins. Nothing is uploaded.</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="rounded border border-[var(--praxis-line-subtle)] p-2 text-[var(--praxis-text-secondary)]" aria-label="Refresh summary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/></button><button onClick={exportSummary} disabled={!summary} className="inline-flex items-center gap-2 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40"><Download size={14}/> Export</button></div></div>{summary ? <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Sessions", summary.sessions], ["Check-ins", summary.checkins], ["Understandable", summary.ratings?.understandable], ["Will practice", summary.ratings?.will_practice]].map(([label, value]) => <div key={label} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4"><div className="text-[10px] uppercase tracking-widest text-[var(--praxis-text-muted)]">{label}</div><div className="mt-2 text-lg font-medium text-[var(--praxis-text-primary)]">{value ?? 0}</div></div>)}</div>{summary.friction_tags?.length ? <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4"><div className="text-[10px] uppercase tracking-widest text-[var(--praxis-text-muted)]">Recent friction</div><ul className="mt-3 space-y-2">{summary.friction_tags.map((item, index) => <li key={`${item}-${index}`} className="text-xs leading-5 text-[var(--praxis-text-secondary)]">{item}</li>)}</ul></div> : <p className="text-xs text-[var(--praxis-text-muted)]">No friction notes yet. They will appear after session check-ins.</p>}</> : null}</div>;
}
