import { useEffect, useMemo, useRef, useState } from "react";
import {
  Captions,
  ChevronDown,
  Copy,
  Expand,
  FileText,
  ListChecks,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import { SessionWaveform } from "./SessionWaveform.jsx";
import { CoachingReport, PracticeTracker } from "./SessionReportSections.jsx";
import { getReadyReportLayout } from "../../lib/reportLayout.js";
import { Button } from "../ui/Button.jsx";
import { ScoreBar } from "./ScoreBar.jsx";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueRows(values) {
  return values.filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).slice(0, 3);
}

export function SessionReviewWorkspace({
  meta,
  analysis,
  analysisRaw,
  transcript,
  waveform,
  currentTime,
  duration,
  videoSrc,
  videoRef,
  subtitleTracks,
  subtitleExport,
  sessionId,
  onSeek,
  onVideoMetadata,
  onPlay,
  onPause,
  onTimeUpdate,
  onPracticeUpdate,
  onReanalyze,
  reanalyzing = false,
  practiceContext,
  onNavigate,
  onBack,
  onRename,
  onOpenLocalFiles,
  formatTimestamp,
  processingContent,
}) {
  const [tab, setTab] = useState("transcript");
  const [playing, setPlaying] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meta.title || "");
  const [leftWidth, setLeftWidth] = useState(() => Number(window.localStorage.getItem("praxis.session.split")) || 58);
  const workspaceRef = useRef(null);
  const transcriptRowsRef = useRef(new Map());
  const v3Report = Number(analysis?.schema_version) === 3 ? (analysis?.report || {}) : null;
  const report = analysis?.coaching_report || {};
  const lesson = Array.isArray(report.top_lessons) ? report.top_lessons[0] : null;
  const assignment = report.practice_assignment || {};
  const verdict = text(v3Report?.verdict) || text(report.opening_read) || text(analysis?.prose_verdict) || text(analysis?.session_summary) || "Your report will appear when analysis is ready.";
  const focusTitle = text(v3Report?.priority_improvement?.title) || text(v3Report?.next_goal?.text) || text(lesson?.title) || text(assignment.next_session_goal) || "Choose one clear improvement";
  const focusBody = text(v3Report?.priority_improvement?.replacement_behavior) || text(v3Report?.practice?.instructions) || text(lesson?.next_move) || text(lesson?.why_it_matters) || text(assignment.speaking_drill) || "Use the evidence moments below to select your next practice action.";
  const worked = uniqueRows([
    text(v3Report?.strength?.explanation),
    text(report.what_improved),
    ...(Array.isArray(analysis?.ideas_and_reasoning?.strong_points) ? analysis.ideas_and_reasoning.strong_points.map(text) : []),
    text(analysis?.speaking_quality?.executive_presence_notes),
  ]);
  const moments = useMemo(() => {
    const fromReport = v3Report?.evidence_moments?.length ? v3Report.evidence_moments : [
      report.best_moment,
      ...(Array.isArray(report.moment_feedback) ? report.moment_feedback : []),
    ].filter(Boolean);
    const fromTranscript = transcript.slice(0, 3).map((segment) => ({
      timestamp_seconds: segment.start_seconds,
      label: "Transcript moment",
      coaching_note: segment.text,
    }));
    return (fromReport.length ? fromReport : fromTranscript).slice(0, 3);
  }, [report.best_moment, report.moment_feedback, transcript, v3Report]);
  const v3Scorecard = analysis?.details?.scorecard || {};
  const scoreRows = [
    ["Clarity", analysis?.speaking_quality?.clarity ?? analysis?.scorecard?.clarity?.score ?? v3Scorecard.clarity?.score],
    ["Structure", analysis?.speaking_quality?.structure ?? analysis?.scorecard?.structure?.score ?? v3Scorecard.structure?.score],
    ["Fluency", analysis?.speaking_quality?.fluency ?? analysis?.scorecard?.language_fluency?.score ?? v3Scorecard.language_fluency?.score],
    ["Confidence", analysis?.speaking_quality?.confidence ?? analysis?.scorecard?.confidence?.score ?? v3Scorecard.confidence?.score],
  ].filter(([, value]) => value !== null && value !== undefined);
  const reportLayout = getReadyReportLayout();

  useEffect(() => {
    window.localStorage.setItem("praxis.session.split", String(leftWidth));
  }, [leftWidth]);

  function resizeFromPointer(clientX) {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setLeftWidth(Math.max(45, Math.min(70, ((clientX - bounds.left) / bounds.width) * 100)));
  }

  function beginResize(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    function move(pointerEvent) { resizeFromPointer(pointerEvent.clientX); }
    function end() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  function seekAndReveal(seconds) {
    onSeek(seconds);
    const closest = transcript.reduce((best, segment) => {
      if (!best) return segment;
      return Math.abs(Number(segment.start_seconds) - seconds) < Math.abs(Number(best.start_seconds) - seconds) ? segment : best;
    }, null);
    transcriptRowsRef.current.get(closest)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }

  return (
    <div ref={workspaceRef} className="flex min-h-0 flex-1 overflow-hidden">
      <section style={{ flex: "0 0 " + leftWidth + "%" }} className="flex min-w-0 flex-col bg-[var(--praxis-bg-canvas)]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--praxis-line-subtle)] px-5 py-3">
          <div className="min-w-0">
            <button type="button" aria-label="Back to sessions" onClick={onBack} className="mb-2 text-xs text-[var(--praxis-text-muted)] hover:text-[var(--praxis-text-primary)]">← Back to sessions</button>
            {editingTitle ? <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); onRename?.(titleDraft); setEditingTitle(false); }}><input autoFocus value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} aria-label="Session title" className="h-8 min-w-0 rounded-md border border-[var(--praxis-accent)] bg-[var(--praxis-bg-elevated)] px-2 text-sm font-semibold text-[var(--praxis-text-primary)] outline-none" /><button type="submit" className="text-xs text-[var(--praxis-accent)]">Save</button></form> : <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--praxis-text-primary)]">{meta.title || "Untitled session"}</h1>}
            <p className="mt-1 text-[11px] text-[var(--praxis-text-muted)]">
              {meta.language?.toUpperCase() || "—"} · {formatTimestamp(duration)} · <span>{meta.status === "video_only" ? "video only" : "stored locally"}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onOpenLocalFiles} className="rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2.5 py-1.5 text-xs text-[var(--praxis-text-secondary)] hover:text-[var(--praxis-text-primary)]"><FileText size={14} className="mr-1.5 inline" /> Local files</button><button type="button" onClick={() => { setTitleDraft(meta.title || ""); setEditingTitle(true); }} className="hidden rounded-md px-2.5 py-1.5 text-xs text-[var(--praxis-text-secondary)] hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)] md:block">Rename</button><details className="relative"><summary className="cursor-pointer list-none rounded-md px-2 py-1.5 text-xs text-[var(--praxis-text-secondary)] hover:bg-[var(--praxis-bg-hover)]">More</summary><div className="praxis-glass-overlay absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-[var(--praxis-line-strong)] p-1 text-xs"><button type="button" onClick={onOpenLocalFiles} className="w-full rounded px-2 py-1.5 text-left text-[var(--praxis-text-secondary)] hover:bg-[var(--praxis-bg-hover)]">Open session folder</button></div></details></div>
        </div>

        <div className="praxis-video-stage relative mx-5 mt-5 aspect-video shrink-0 overflow-hidden rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-video-surface)]">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              crossOrigin="anonymous"
              playsInline
              className="h-full w-full object-contain"
              onLoadedMetadata={onVideoMetadata}
              onDurationChange={onVideoMetadata}
              onPlay={() => { setPlaying(true); onPlay(); }}
              onPause={() => { setPlaying(false); onPause(); }}
              onEnded={() => { setPlaying(false); onPause(); }}
              onTimeUpdate={onTimeUpdate}
            >
              {subtitleTracks.map((track) => (
                <track key={track.language} kind="subtitles" srcLang={track.language} label={track.language.toUpperCase()} src={track.src} default={track.language === meta.language} />
              ))}
            </video>
          ) : (
            <div className="grid h-full place-items-center text-sm text-[var(--praxis-text-muted)]">No video stored for this session.</div>
          )}

          {videoSrc ? (
            <div className="praxis-video-controls praxis-glass-overlay absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-md border border-[var(--praxis-line-subtle)] px-2.5 py-2">
              <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause playback" : "Play session"} className="grid h-7 w-7 place-items-center rounded-md bg-[var(--praxis-accent)] text-[var(--praxis-on-accent)]">
                {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              <input
                type="range"
                min="0"
                max={Math.max(1, duration)}
                value={Math.min(currentTime, Math.max(1, duration))}
                onChange={(event) => onSeek(Number(event.target.value), false)}
                aria-label="Playback position"
                className="h-1 min-w-0 flex-1 accent-[var(--praxis-accent)]"
              />
              <span className="font-mono text-[11px] text-[var(--praxis-text-primary)]">{formatTimestamp(currentTime)} / {formatTimestamp(duration)}</span>
              <Volume2 size={15} className="text-[var(--praxis-text-secondary)]" />
              <Captions size={15} className="text-[var(--praxis-text-secondary)]" />
              <Expand size={15} className="text-[var(--praxis-text-secondary)]" />
            </div>
          ) : null}
        </div>

        <div className="mx-5 mt-3">
          <SessionWaveform bars={waveform} segments={transcript} evidence={moments} currentTime={currentTime} duration={duration} onSeek={seekAndReveal} />
        </div>

        {subtitleExport && videoSrc ? (
          <div className="mx-5 mt-3 flex flex-wrap items-center gap-2 border-b border-[var(--praxis-line-subtle)] pb-3">
            <Captions size={15} className="text-[var(--praxis-accent)]" aria-hidden="true" />
            <span className="mr-1 text-xs font-medium text-[var(--praxis-text-primary)]">Export subtitles</span>
            <label className="text-[11px] text-[var(--praxis-text-muted)]">Primary
              <select value={subtitleExport.language} onChange={(event) => subtitleExport.onLanguageChange(event.target.value)} className="ml-1 h-7 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-1.5 text-xs text-[var(--praxis-text-primary)]">
                {[["en", "English"], ["fr", "French"], ["es", "Spanish"], ["ar", "Arabic"]].map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-[var(--praxis-text-muted)]">Second line
              <select value={subtitleExport.secondaryLanguage} onChange={(event) => subtitleExport.onSecondaryLanguageChange(event.target.value)} className="ml-1 h-7 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-1.5 text-xs text-[var(--praxis-text-primary)]">
                <option value="">None</option>
                {[["en", "English"], ["fr", "French"], ["es", "Spanish"], ["ar", "Arabic"]].filter(([code]) => code !== subtitleExport.language).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <button type="button" onClick={subtitleExport.onExport} disabled={subtitleExport.exporting} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent)] px-2.5 text-xs font-medium text-[var(--praxis-on-accent)] disabled:opacity-50">
              <Captions size={13} /> {subtitleExport.exporting ? "Exporting…" : "Export MP4"}
            </button>
            <p className="basis-full text-[11px] text-[var(--praxis-text-muted)]">Translations are generated from your transcript by the AI provider you chose; source and translated lines are burned into the exported MP4.</p>
          </div>
        ) : null}

        <div className="mx-5 mt-3 flex items-center gap-1 border-b border-[var(--praxis-line-subtle)]">
          {[
            ["transcript", "Transcript"],
            ["notes", "Notes"],
            ["chapters", "Chapters"],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={"border-b-2 px-3 py-2 text-xs transition-colors " + (tab === id ? "border-[var(--praxis-accent)] text-[var(--praxis-text-primary)]" : "border-transparent text-[var(--praxis-text-muted)] hover:text-[var(--praxis-text-secondary)]")}>{label}</button>
          ))}
          <button type="button" className="ml-auto inline-flex items-center gap-1.5 px-2 py-2 text-xs text-[var(--praxis-accent)]"><Copy size={13} /> Add note at {formatTimestamp(currentTime)}</button>
        </div>

        <div className="praxis-reading-surface mx-5 mb-5 min-h-0 flex-1 overflow-y-auto rounded-b-lg px-4 py-3">
          {tab === "transcript" && (transcript.length ? transcript.map((segment, index) => {
            const start = Number(segment.start_seconds) || 0;
            const end = Number(segment.end_seconds) || start;
            const active = currentTime >= start && currentTime < (end || Number.POSITIVE_INFINITY);
            return (
              <button ref={(node) => { if (node) transcriptRowsRef.current.set(segment, node); else transcriptRowsRef.current.delete(segment); }} key={String(start) + "-" + index} type="button" onClick={() => onSeek(start)} className={"mb-1 flex w-full gap-4 rounded-md px-2 py-2 text-left transition-colors " + (active ? "bg-[var(--praxis-selected)]" : "hover:bg-[var(--praxis-bg-hover)]")}>
                <span className="w-11 shrink-0 pt-0.5 font-mono text-[11px] text-[var(--praxis-text-muted)]">{formatTimestamp(start)}</span>
                <span className="max-w-[72ch] text-sm leading-6 text-[var(--praxis-text-secondary)]">{segment.text}</span>
              </button>
            );
          }) : <p className="py-8 text-sm text-[var(--praxis-text-muted)]">No transcript is stored for this session.</p>)}
          {tab === "notes" && <p className="py-8 text-sm text-[var(--praxis-text-muted)]">Notes stay attached to exact moments. Add the first note from the playback bar.</p>}
          {tab === "chapters" && <p className="py-8 text-sm text-[var(--praxis-text-muted)]">Chapters appear when Praxis finds meaningful shifts in the session.</p>}
        </div>
      </section>

      <div
        role="separator"
        aria-label="Resize report panes"
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={beginResize}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); setLeftWidth((value) => Math.max(45, value - 2)); }
          if (event.key === "ArrowRight") { event.preventDefault(); setLeftWidth((value) => Math.min(70, value + 2)); }
        }}
        className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-[var(--praxis-line-subtle)] outline-none hover:bg-[var(--praxis-accent)] focus:bg-[var(--praxis-accent)]"
      ><span className="absolute left-1/2 top-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--praxis-bg-elevated)] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" /></div>
      <aside
        className="praxis-reading-surface flex min-w-[360px] flex-1 flex-col overflow-hidden border-l border-[var(--praxis-line-subtle)]"
        data-report-layout="control-room"
      >
        {!analysis ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{processingContent}</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5" data-section-order={reportLayout.sectionOrder.join(",")}>
            <div data-report-section="verdict">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--praxis-text-primary)]">Report</h2>
                <div className="flex items-center gap-2">
                  {onReanalyze ? <button type="button" onClick={onReanalyze} disabled={reanalyzing} className="inline-flex h-7 items-center gap-1.5 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] px-2.5 text-[11px] text-[var(--praxis-text-secondary)] transition-colors hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)] disabled:opacity-50">{reanalyzing ? "Requesting…" : "Run fresh analysis"}</button> : null}
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--praxis-text-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--praxis-success)]" aria-hidden="true" />
                    Stored locally
                  </span>
                </div>
              </div>
              <p className="mt-4 max-w-[45ch] text-[15px] leading-7 text-[var(--praxis-text-primary)]">{verdict}</p>

              {scoreRows.length ? <div className="mt-4 space-y-2 py-1" aria-label="Scorecard">{scoreRows.map(([label, value]) => <ScoreBar key={label} label={label} value={value} />)}</div> : null}
            </div>

            {worked.length ? (
              <section className="mt-6" data-report-section="what_worked">
                <h3 className="text-sm font-semibold text-[var(--praxis-text-primary)]">What worked</h3>
                <div className="mt-2 space-y-2">
                  {worked.map((item) => (
                    <div key={item} className="flex gap-2 py-1 text-sm leading-5 text-[var(--praxis-text-secondary)]">
                      <span className="text-[var(--praxis-success)]">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section
              className="mt-6 rounded-[var(--praxis-radius-md)] border border-[var(--praxis-accent)]/35 bg-[var(--praxis-accent-muted)] p-4"
              data-report-section="focus_next"
            >
              <div className="text-[11px] font-medium text-[var(--praxis-accent)]">Focus next</div>
              <h3 className="mt-2 text-base font-semibold text-[var(--praxis-text-primary)]">{focusTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--praxis-text-secondary)]">{focusBody}</p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  id={reportLayout.primaryCtaId}
                  data-primary-cta="true"
                  data-cta={reportLayout.primaryCtaId}
                  onClick={() => onNavigate("practice")}
                  className="inline-flex items-center gap-1.5"
                >
                  <ListChecks size={14} />
                  {reportLayout.primaryCtaLabel}
                </Button>
              </div>
            </section>

            <section className="mt-6" data-report-section="evidence">
              <h3 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Evidence</h3>
              <div className="mt-2 space-y-3">
                {moments.map((moment, index) => {
                  const timestamp = Number(moment.timestamp_seconds) || 0;
                  return (
                    <button
                      key={String(timestamp) + "-" + index}
                      type="button"
                      onClick={() => seekAndReveal(timestamp)}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[var(--praxis-bg-hover)]"
                    >
                      <Play size={13} className="text-[var(--praxis-accent)]" />
                      <span className="w-10 font-mono text-[11px] text-[var(--praxis-text-muted)] tnum">
                        {formatTimestamp(timestamp)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--praxis-text-secondary)]">
                        {moment.label || moment.coaching_note || "Session moment"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <details className="mt-6 border-y border-[var(--praxis-line-subtle)]" data-report-section="detailed_feedback">
              <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm text-[var(--praxis-text-secondary)]">
                Detailed language feedback <ChevronDown size={15} />
              </summary>
              <div className="pb-5">
                <CoachingReport analysis={analysis} onSeek={onSeek} currentTime={currentTime} />
                <PracticeTracker meta={meta} practiceContext={practiceContext} onUpdate={onPracticeUpdate} />
                {analysisRaw ? (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-[11px] text-[var(--praxis-text-muted)]">
                      Raw AI response (local file)
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-video-surface)]/20 p-3 text-[11px] text-[var(--praxis-text-muted)]">
                      {analysisRaw}
                    </pre>
                  </details>
                ) : null}
              </div>
            </details>
          </div>
        )}
      </aside>
    </div>
  );
}
