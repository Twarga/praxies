import { useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, Pause, Play, Trash2, X } from "lucide-react";
import {
  activateTranscriptionModel,
  downloadTranscriptionModel,
  getTranscriptionDownload,
  getTranscriptionModels,
  getTranscriptionRuntime,
  pauseTranscriptionDownload,
  resumeTranscriptionDownload,
  cancelTranscriptionDownload,
  removeTranscriptionModel,
  verifyModel,
  getTranscriptionComparisonSessions,
  compareTranscriptionModel,
  benchmarkModel,
} from "../../api/transcription.js";

export function TranscriptionSettingsPanel({ activeModel, pushToast }) {
  const [runtime, setRuntime] = useState(null);
  const [models, setModels] = useState([]);
  const [jobs, setJobs] = useState({});
  const [comparisonSessions, setComparisonSessions] = useState([]);
  const [comparisonSessionId, setComparisonSessionId] = useState("");
  const [benchmark, setBenchmark] = useState(null);
  const [benchmarkingModel, setBenchmarkingModel] = useState("");
  const timerRef = useRef(null);

  async function refresh() {
    const [runtimePayload, catalog, comparisons] = await Promise.all([getTranscriptionRuntime(), getTranscriptionModels(), getTranscriptionComparisonSessions()]);
    setRuntime(runtimePayload);
    setModels(catalog.models || []);
    setComparisonSessions(comparisons.sessions || []);
    setComparisonSessionId((current) => current || comparisons.sessions?.[0]?.id || "");
  }

  useEffect(() => {
    void refresh().catch((error) => pushToast({ kind: "error", message: error instanceof Error ? error.message : "Transcription runtime unavailable." }));
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, []);

  function poll(job) {
    timerRef.current = window.setTimeout(async () => {
      const next = await getTranscriptionDownload(job.download_id);
      setJobs((current) => ({ ...current, [job.model_id]: next }));
      if (["queued", "downloading", "verifying", "testing"].includes(next.state)) poll(next);
      else if (next.state === "ready") { await refresh(); pushToast({ kind: "success", message: "Transcription model installed and verified." }); }
      else pushToast({ kind: "error", message: next.error || "Model installation failed." });
    }, 900);
  }

  async function install(modelId) {
    const job = await downloadTranscriptionModel(modelId);
    setJobs((current) => ({ ...current, [modelId]: job }));
    poll(job);
  }

  async function pause(job) {
    const next = await pauseTranscriptionDownload(job.download_id);
    setJobs((current) => ({ ...current, [job.model_id]: next }));
  }

  async function resume(job) {
    const next = await resumeTranscriptionDownload(job.download_id);
    setJobs((current) => ({ ...current, [job.model_id]: next }));
    poll(next);
  }

  async function cancel(job) {
    await cancelTranscriptionDownload(job.download_id);
    setJobs((current) => { const next = { ...current }; delete next[job.model_id]; return next; });
  }

  async function activate(modelId) {
    await verifyModel(modelId);
    await activateTranscriptionModel(modelId);
    await refresh();
    pushToast({ kind: "success", message: `${modelId} is now active.` });
  }

  async function remove(modelId) {
    await removeTranscriptionModel(modelId);
    await refresh();
    pushToast({ kind: "success", message: `${modelId} removed.` });
  }

  async function compare(modelId) {
    if (!comparisonSessionId) return;
    setBenchmarkingModel(modelId); setBenchmark(null);
    try { setBenchmark(await compareTranscriptionModel(modelId, comparisonSessionId)); }
    catch (error) { pushToast({ kind: "error", message: error instanceof Error ? error.message : "Comparison failed." }); }
    finally { setBenchmarkingModel(""); }
  }

  async function runBenchmark(modelId) {
    setBenchmarkingModel(modelId); setBenchmark(null);
    try { const result = await benchmarkModel(modelId); if (!result.ok && result.message) throw new Error(result.message); setBenchmark({ ...result, benchmark_kind: "bundled" }); }
    catch (error) { pushToast({ kind: "error", message: error instanceof Error ? error.message : "Benchmark failed." }); }
    finally { setBenchmarkingModel(""); }
  }

  const hardware = runtime?.hardware;
  const recommendation = runtime?.recommendation;
  return <div className="space-y-6">
    <div><h3 className="text-base font-semibold text-[var(--praxis-text-primary)]">Local transcription</h3><p className="mt-1 text-xs text-[var(--praxis-text-secondary)]">Models download to your computer and recordings stay local.</p></div>
    {hardware ? <div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-[var(--praxis-line-subtle)] py-4 text-xs text-[var(--praxis-text-secondary)]"><span>{hardware.logical_cores} CPU threads</span><span>{hardware.total_ram_gb} GB RAM</span><span>{hardware.free_disk_gb} GB free</span><span>{hardware.cuda_available ? "CUDA available" : "CPU processing"}</span></div> : null}
    {recommendation ? <div className="rounded border border-[var(--praxis-accent)]/30 bg-[var(--praxis-accent)]/10 px-4 py-3 text-xs text-[var(--praxis-text-primary)]"><strong>Recommended: {recommendation.recommended_model}</strong><div className="mt-1 text-[var(--praxis-text-secondary)]">{recommendation.reason}</div></div> : null}
    {comparisonSessions.length ? <div className="flex flex-col gap-2 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-medium text-[var(--praxis-text-primary)]">Accuracy comparison recording</div><p className="mt-1 text-[11px] text-[var(--praxis-text-muted)]">Praxis creates a temporary candidate transcript and never replaces the original.</p></div><select value={comparisonSessionId} onChange={(event) => setComparisonSessionId(event.target.value)} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-xs text-[var(--praxis-text-primary)]">{comparisonSessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select></div> : null}
    <div className="divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">
      {models.map((model) => {
        const job = jobs[model.model_id];
        const working = job && ["queued", "downloading", "verifying", "testing"].includes(job.state);
        const isActive = activeModel === model.model_id;
        return <div key={model.model_id} className="flex items-center justify-between gap-5 py-4"><div className="min-w-0"><div className="flex items-center gap-2 text-sm text-[var(--praxis-text-primary)]">{model.display_name || model.model_id}{isActive ? <span className="text-[10px] text-[var(--praxis-success)]">Active</span> : null}</div><div className="mt-1 text-xs text-[var(--praxis-text-muted)]">~{model.estimated_disk_gb} GB disk · ~{model.estimated_ram_gb} GB RAM · {model.languages.join(", ")}</div>{job ? <div className="mt-1 text-[10px] text-[var(--praxis-warning)]">{job.state}{job.error ? ` · ${job.error}` : ""}</div> : null}</div><div className="flex shrink-0 gap-2">{model.installed ? <><button type="button" onClick={() => void runBenchmark(model.model_id)} disabled={!!benchmarkingModel} className="inline-flex h-8 items-center rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40">{benchmarkingModel === model.model_id ? "Testing…" : "Speed test"}</button><button type="button" onClick={() => void compare(model.model_id)} disabled={!comparisonSessionId || !!benchmarkingModel} className="inline-flex h-8 items-center rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40">Compare journal</button><button type="button" onClick={() => void activate(model.model_id)} disabled={isActive} className="inline-flex h-8 items-center gap-1 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40"><Check size={13} /> Use</button><button type="button" onClick={() => void remove(model.model_id)} disabled={isActive} className="rounded p-2 text-[var(--praxis-record)] disabled:opacity-30" aria-label="Remove model"><Trash2 size={14} /></button></> : job?.state === "paused" ? <><button type="button" onClick={() => void resume(job)} className="inline-flex h-8 items-center gap-1 rounded bg-[var(--praxis-bg-elevated)] px-3 text-xs text-[var(--praxis-text-primary)]"><Play size={13} /> Resume</button><button type="button" onClick={() => void cancel(job)} className="rounded p-2 text-[var(--praxis-record)]" aria-label="Cancel download"><X size={14} /></button></> : working ? <><button type="button" onClick={() => void pause(job)} disabled={job.state !== "downloading"} className="inline-flex h-8 items-center gap-1 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40"><Pause size={13} /> Pause</button><Loader2 size={16} className="mt-2 animate-spin text-[var(--praxis-warning)]" /></> : <button type="button" onClick={() => void install(model.model_id)} className="inline-flex h-8 items-center gap-2 rounded bg-[var(--praxis-bg-elevated)] px-3 text-xs text-[var(--praxis-text-primary)]"><Download size={13} /> Download</button>}</div></div>;
      })}
    </div>
    {benchmark ? <div className="rounded border border-[var(--praxis-success)]/30 bg-[var(--praxis-success-soft)] p-4"><div className="text-xs font-medium text-[var(--praxis-text-primary)]">{benchmark.model_id} {benchmark.benchmark_kind === "bundled" ? "licensed clip benchmark" : "journal comparison"}</div><div className="mt-3 grid grid-cols-3 gap-3 text-xs"><div><span className="text-[var(--praxis-text-muted)]">Accuracy</span><div className="mt-1 text-[var(--praxis-text-primary)]">{benchmark.word_error_rate != null ? `${Math.max(0, (1 - benchmark.word_error_rate) * 100).toFixed(1)}%` : `${benchmark.text_similarity_percent}%`}</div></div><div><span className="text-[var(--praxis-text-muted)]">Processing</span><div className="mt-1 text-[var(--praxis-text-primary)]">{benchmark.processing_seconds}s</div></div><div><span className="text-[var(--praxis-text-muted)]">Real-time factor</span><div className="mt-1 text-[var(--praxis-text-primary)]">{benchmark.real_time_factor}×</div></div></div><p className="mt-3 max-h-24 overflow-y-auto text-[11px] leading-5 text-[var(--praxis-text-secondary)]">{benchmark.transcript_text || benchmark.candidate_text || "No speech detected."}</p></div> : null}
  </div>;
}
