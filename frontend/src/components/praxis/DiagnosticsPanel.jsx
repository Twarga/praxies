import { useEffect, useState } from "react";
import { Download, FolderOpen, RefreshCw, RotateCcw, Wrench } from "lucide-react";
import { getSupportBundle, repairIndex, resetOnboarding, retestDiagnostics } from "../../api/diagnostics.js";
import { RuntimeHealthRow } from "./RuntimeHealthRow.jsx";
import { openDesktopPath } from "../../lib/desktop.js";

export function DiagnosticsPanel({ pushToast }) {
  const [checks, setChecks] = useState([]);
  const [busy, setBusy] = useState("");
  async function retest() {
    setBusy("retest");
    try { const result = await retestDiagnostics(); setChecks(result.checks || []); }
    catch (error) { pushToast?.({ kind: "error", message: error instanceof Error ? error.message : "Diagnostics failed." }); }
    finally { setBusy(""); }
  }
  useEffect(() => { void retest(); }, []);
  async function repair() {
    setBusy("repair");
    try { const result = await repairIndex(); pushToast?.({ kind: "success", message: result.message }); await retest(); }
    catch (error) { pushToast?.({ kind: "error", message: error instanceof Error ? error.message : "Index repair failed." }); setBusy(""); }
  }
  async function exportBundle() {
    setBusy("export");
    try {
      const bundle = await getSupportBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `praxis-support-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
      pushToast?.({ kind: "success", message: "Redacted support report exported." });
    } catch (error) { pushToast?.({ kind: "error", message: error instanceof Error ? error.message : "Export failed." }); }
    finally { setBusy(""); }
  }
  async function openLocation(key) { try { const bundle = await getSupportBundle(); await openDesktopPath(bundle[key]); } catch (error) { pushToast?.({ kind: "error", message: error instanceof Error ? error.message : "Could not open path." }); } }
  async function restartSetup() { if (!window.confirm("Reopen onboarding? Your journal and settings will be preserved.")) return; const result = await resetOnboarding(); pushToast?.({ kind: "success", message: result.message }); window.location.reload(); }
  return <div className="space-y-5"><div><h3 className="text-base font-semibold text-[var(--praxis-text-primary)]">System health</h3><p className="mt-1 text-xs text-[var(--praxis-text-secondary)]">Local checks for storage, media tools, transcription, and credential security.</p></div><RuntimeHealthRow checks={checks} onRetest={() => void retest()} /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void retest()} disabled={!!busy} className="inline-flex h-9 items-center gap-2 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40"><RefreshCw size={14} className={busy === "retest" ? "animate-spin" : ""}/> Retest</button><button type="button" onClick={() => void repair()} disabled={!!busy} className="inline-flex h-9 items-center gap-2 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40"><Wrench size={14}/> Rebuild journal index</button><button type="button" onClick={() => void openLocation("journal_path")} className="inline-flex h-9 items-center gap-2 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)]"><FolderOpen size={14}/> Open journal</button><button type="button" onClick={() => void openLocation("backend_log_path")} className="inline-flex h-9 items-center gap-2 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)]"><FolderOpen size={14}/> Open logs</button><button type="button" onClick={() => void exportBundle()} disabled={!!busy} className="inline-flex h-9 items-center gap-2 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-40"><Download size={14}/> Export redacted support report</button><button type="button" onClick={() => void restartSetup()} className="inline-flex h-9 items-center gap-2 rounded border border-[var(--praxis-line-subtle)] px-3 text-xs text-[var(--praxis-text-primary)]"><RotateCcw size={14}/> Reopen onboarding</button></div><p className="text-[11px] leading-5 text-[var(--praxis-text-muted)]">The support report contains versions, status counts, diagnostic results, and paths. It excludes API keys, transcripts, videos, and report content.</p></div>;
}
