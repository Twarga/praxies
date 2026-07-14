import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Captions,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  RotateCcw,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportSessionSubtitledVideo,
  exportSessionPrompt,
  exportSessionTranscript,
  getSessionExportedVideoUrl,
  getSessionSubtitleUrl,
  getSessionVideoUrl,
  loadSession,
  markSessionRead,
  renameSession,
  reanalyzeSession,
  retrySessionProcessing,
  updateSessionPractice,
} from "../api/sessions.js";
import { useConfig } from "../hooks/useConfig.js";
import { useIndex } from "../hooks/useIndex.js";
import { useToast } from "../hooks/useToast.js";
import {
  formatDuration,
  formatLongDate,
  getSessionTitle,
  getStatusBadgeStyle,
  getStatusLabel,
  isAttentionStatus,
  isProcessingStatus,
  isReadyStatus,
} from "../lib/sessionUi.js";
import { openDesktopPath } from "../lib/desktop.js";
import { SessionCheckin } from "../components/praxis/SessionCheckin.jsx";
import { SessionWaveform } from "../components/praxis/SessionWaveform.jsx";
import { SessionReviewWorkspace } from "../components/praxis/SessionReviewWorkspace.jsx";
import {
  CoachingReport,
  FillerWords,
  hasReadableCoachingReport,
  ListBlock,
  PatternsHitTodayBlock,
  PracticeTracker,
  StatBlock,
} from "../components/praxis/SessionReportSections.jsx";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/Tabs.jsx";

const SUBTITLE_LANGUAGE_OPTIONS = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "ar", label: "AR" },
];

function getDefaultSubtitleLanguage(sourceLanguage) {
  return SUBTITLE_LANGUAGE_OPTIONS.find((option) => option.code !== sourceLanguage)?.code ?? "en";
}

function formatSecondsTimestamp(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatTerminalTimestamp(value) {
  if (!value) return "--:--:--";
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--:--";
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeMediaDuration(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function readTimelineDurationFromVideo(video, fallbackDuration = 0) {
  if (!video) return normalizeMediaDuration(fallbackDuration);

  const nativeDuration = normalizeMediaDuration(video.duration);
  if (nativeDuration > 0) return nativeDuration;

  try {
    if (video.seekable?.length) {
      const seekableDuration = normalizeMediaDuration(video.seekable.end(video.seekable.length - 1));
      if (seekableDuration > 0) return seekableDuration;
    }
  } catch {}

  try {
    if (video.buffered?.length) {
      const bufferedDuration = normalizeMediaDuration(video.buffered.end(video.buffered.length - 1));
      if (bufferedDuration > 0) return bufferedDuration;
    }
  } catch {}

  return normalizeMediaDuration(fallbackDuration);
}

async function copyText(text) {
  if (!text) throw new Error("Nothing to copy.");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function getProcessingPercent(status, processing) {
  const explicit = Number(processing?.progress_percent);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(0, Math.min(100, explicit));
  }
  if (status === "queued") return 2;
  if (status === "transcribing") return 35;
  if (status === "analyzing") return 75;
  if (status === "ready" || status === "done") return 100;
  if (status === "failed" || status === "needs_attention") return 100;
  return 0;
}

function getProcessingLabel(status, processing, saveMode) {
  if (processing?.progress_label) return processing.progress_label;
  if (status === "queued") return "Queued for processing";
  if (status === "transcribing") return "Transcribing speech";
  if (status === "analyzing") return "Running AI analysis";
  if (status === "ready" || status === "done") {
    return saveMode === "transcribe_only" ? "Transcript ready" : "Analysis ready";
  }
  if (status === "needs_attention") return "Needs attention";
  if (status === "failed") return "Processing failed";
  return "Waiting";
}

function getProcessingStepTone(step, meta) {
  const status = meta?.status;
  if (status === "ready" || status === "done") return "done";
  if (status === "needs_attention" || status === "failed") {
    if (step.id === status) return "active";
  }
  if (step.id === "queued") {
    if (status === "queued") return "active";
    if (status !== "recording" && status !== "saved") return "done";
  }
  if (step.id === "transcribing") {
    if (status === "transcribing") return "active";
    if (status === "analyzing" || status === "ready" || status === "done") return "done";
  }
  if (step.id === "analyzing") {
    if (status === "analyzing") return "active";
    if (status === "ready" || status === "done") return "done";
  }
  if (step.id === "ready" && (status === "ready" || status === "done")) return "done";
  return "idle";
}

function getTerminalLineTone(level) {
  if (level === "success") return "text-[var(--praxis-success)]";
  if (level === "warning") return "text-[var(--praxis-warning)]";
  if (level === "error") return "text-[var(--praxis-danger)]";
  return "text-[var(--praxis-text-secondary)]";
}

function PipelineStep({ step, meta }) {
  const tone = getProcessingStepTone(step, meta);
  const toneClass =
    tone === "done"
      ? "border-[var(--praxis-success)]/40 bg-[var(--praxis-success-soft)] text-[var(--praxis-success)]"
      : tone === "active"
        ? "border-[var(--praxis-warning)]/40 bg-[var(--praxis-warning)]/10 text-[var(--praxis-warning)]"
        : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-secondary)]";

  return (
    <div className={`rounded-lg border px-3 py-2 transition-colors ${toneClass}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-60">{step.kicker}</div>
      <div className="mt-1 text-sm font-medium">{step.label}</div>
    </div>
  );
}

function LoadingSessionState() {
  return (
    <div className="flex h-full flex-col bg-[var(--praxis-bg-app)]" role="status" aria-label="Loading session">
      <header className="h-16 shrink-0 border-b border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-8 flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
        <div className="h-6 w-24 rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 p-8 lg:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
          <div className="aspect-video rounded bg-[var(--praxis-bg-app)] praxis-shimmer" />
          <div className="mt-4 h-3 w-2/3 rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
          <div className="mt-3 h-3 w-1/2 rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
            <div className="h-3 w-28 rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
            <div className="mt-5 h-5 w-3/4 rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
            <div className="mt-3 h-3 w-full rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
            <div className="mt-2 h-3 w-5/6 rounded bg-[var(--praxis-line-subtle)] praxis-shimmer" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-28 rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] praxis-shimmer" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProcessingPanel({ meta, transcript, analysis, retrying, onRetry }) {
  const processing = meta?.processing || {};
  const progressPercent = getProcessingPercent(meta?.status, processing);
  const progressLabel = getProcessingLabel(meta?.status, processing, meta?.save_mode);
  const needsAttention = isAttentionStatus(meta?.status);
  const terminalLines = processing.terminal_lines || [];
  const steps =
    meta?.save_mode === "transcribe_only"
      ? [
          { id: "queued", kicker: "01", label: "Queued" },
          { id: "transcribing", kicker: "02", label: "Whisper" },
          { id: "ready", kicker: "03", label: "Transcript Ready" },
        ]
      : [
          { id: "queued", kicker: "01", label: "Queued" },
          { id: "transcribing", kicker: "02", label: "Whisper" },
          { id: "analyzing", kicker: "03", label: "AI Analysis" },
          { id: "ready", kicker: "04", label: "Review Ready" },
        ];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">
              Live pipeline
            </div>
            <h3 className="mt-2 text-lg font-semibold text-[var(--praxis-text-primary)]">{progressLabel}</h3>
            <p className="mt-2 text-sm text-[var(--praxis-text-secondary)] max-w-xl">
              {needsAttention
                ? "Your recording is safe, but processing stopped before the report was ready. Read the error below, repair the provider or model if needed, then retry."
                : "The recording is already saved. Whisper transcription and AI review continue in the background while this page streams the latest state."}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">Progress</div>
            <div className="mt-1 text-2xl font-light tnum text-[var(--praxis-text-primary)]">{progressPercent}%</div>
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-[var(--praxis-bg-app)] overflow-hidden">
          <div
            className={`h-full origin-left transition-transform duration-[var(--praxis-duration-pane)] ease-[var(--praxis-ease-out)] ${needsAttention ? "bg-[var(--praxis-warning)]" : "bg-gradient-to-r from-[var(--praxis-warning)] via-[var(--praxis-warning)] to-[var(--praxis-success)]"}`}
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />
        </div>

        <div className={`mt-4 grid gap-3 ${steps.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
          {steps.map((step) => (
            <PipelineStep key={step.id} step={step} meta={meta} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock
          label="Current Engine"
          value={processing.model_used || (meta?.status === "transcribing" ? "Whisper" : "Waiting")}
        />
        <StatBlock label="Attempts" value={processing.attempts ?? 0} />
        <StatBlock label="Transcript Segments" value={transcript.length || 0} />
        <StatBlock
          label="Analysis"
          value={analysis ? "Stored" : meta?.save_mode === "transcribe_only" ? "Skipped" : "Pending"}
        />
      </div>

      <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">
              Mini terminal
            </div>
            <div className="mt-1 text-sm text-[var(--praxis-text-secondary)]">
              Stage-by-stage output from the local processing pipeline.
            </div>
          </div>
          {isAttentionStatus(meta?.status) ? (
            <button
              type="button"
              disabled={retrying}
              onClick={() => void onRetry()}
              className="px-3 py-2 bg-[var(--praxis-warning)]/20 hover:bg-[var(--praxis-warning)]/30 border border-[var(--praxis-warning)]/40 text-[var(--praxis-warning)] rounded text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <RotateCcw size={14} />
              {retrying ? "Retrying..." : "Retry"}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest opacity-60">
              <Loader2 size={14} className={isProcessingStatus(meta?.status) ? "animate-spin" : ""} />
              {getStatusLabel(meta?.status)}
            </div>
          )}
        </div>

        <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-4 py-3 font-mono text-[11px] leading-6">
          {terminalLines.length === 0 ? (
            <div className="text-[var(--praxis-text-secondary)]">Waiting for the backend to emit processing logs.</div>
          ) : (
            terminalLines.map((line, index) => (
              <div key={`${line.created_at}-${index}`} className="grid grid-cols-[70px_1fr] gap-3">
                <span className="text-[var(--praxis-text-muted)]">{formatTerminalTimestamp(line.created_at)}</span>
                <span className={getTerminalLineTone(line.level)}>{line.message}</span>
              </div>
            ))
          )}
        </div>

        {meta?.error ? (
          <div className="mt-4 rounded-lg border border-[var(--praxis-danger)]/40 bg-[var(--praxis-danger-soft)] px-4 py-3 text-sm text-[var(--praxis-danger)]">
            {meta.error}
          </div>
        ) : null}
      </div>

      {transcript.length > 0 ? (
        <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">
            Transcript preview
          </div>
          <div className="mt-3 space-y-2">
            {transcript.slice(0, 4).map((segment, index) => (
              <div
                key={`${segment.start_seconds}-${index}`}
                className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-3 py-2 text-sm text-[var(--praxis-text-secondary)]"
              >
                <span className="mr-3 text-[10px] font-mono uppercase tracking-widest opacity-50">
                  {formatSecondsTimestamp(segment.start_seconds)}
                </span>
                {segment.text}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SessionDetail({ sessionId, onNavigate, scrollRef }) {
  const { config } = useConfig();
  const { refreshIndex } = useIndex();
  const { pushToast } = useToast();

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("analysis");
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [subtitleLanguage, setSubtitleLanguage] = useState("fr");
  const [secondarySubtitleLanguage, setSecondarySubtitleLanguage] = useState("");
  const [subtitleExporting, setSubtitleExporting] = useState(false);
  const videoRef = useRef(null);
  const markedReadRef = useRef(false);
  const playbackFrameRef = useRef(null);
  const playbackFrameModeRef = useRef("raf");
  const lastPlaybackUiUpdateRef = useRef(0);

  async function refreshBundle() {
    setLoading(true);
    setError(null);
    try {
      const next = await loadSession(sessionId);
      setBundle(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load session.");
    } finally {
      setLoading(false);
    }
  }

  function stopPlaybackTracking() {
    if (playbackFrameRef.current == null) {
      return;
    }

    if (playbackFrameModeRef.current === "video-frame" && videoRef.current?.cancelVideoFrameCallback) {
      videoRef.current.cancelVideoFrameCallback(playbackFrameRef.current);
    } else {
      cancelAnimationFrame(playbackFrameRef.current);
    }
    playbackFrameRef.current = null;
  }

  function syncPlaybackTime(force = false) {
    const now = performance.now();
    // Video callbacks can run at 60+ fps. Ten UI updates per second are smooth
    // for the playhead while avoiding a full report-tree render per frame.
    if (!force && now - lastPlaybackUiUpdateRef.current < 100) return;
    lastPlaybackUiUpdateRef.current = now;
    const nextTime = videoRef.current?.currentTime ?? 0;
    setCurrentTime(nextTime);
    setMediaDuration(readTimelineDurationFromVideo(videoRef.current, duration));
  }

  function startPlaybackTracking() {
    stopPlaybackTracking();

    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      syncPlaybackTime();
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        playbackFrameRef.current = null;
        return;
      }

      if (typeof videoRef.current.requestVideoFrameCallback === "function") {
        playbackFrameModeRef.current = "video-frame";
        playbackFrameRef.current = videoRef.current.requestVideoFrameCallback(() => tick());
        return;
      }

      playbackFrameModeRef.current = "raf";
      playbackFrameRef.current = requestAnimationFrame(tick);
    };

    if (typeof video.requestVideoFrameCallback === "function") {
      playbackFrameModeRef.current = "video-frame";
      playbackFrameRef.current = video.requestVideoFrameCallback(() => tick());
      return;
    }

    playbackFrameModeRef.current = "raf";
    playbackFrameRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    setLoading(true);
    setError(null);
    setCurrentTime(0);
    setMediaDuration(0);
    lastPlaybackUiUpdateRef.current = 0;
    markedReadRef.current = false;
    stopPlaybackTracking();

    loadSession(sessionId)
      .then((next) => {
        if (!cancelled) {
          setBundle(next);
          setLoading(false);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load session.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      stopPlaybackTracking();
    };
  }, [sessionId]);

  useEffect(() => () => stopPlaybackTracking(), []);

  useEffect(() => {
    if (!bundle?.meta?.status || !isProcessingStatus(bundle.meta.status)) return undefined;
    const id = setInterval(() => {
      loadSession(sessionId)
        .then((next) => setBundle(next))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [bundle?.meta?.status, sessionId]);

  useEffect(() => {
    if (!bundle?.meta) return;
    if (markedReadRef.current) return;
    if (bundle.meta.read) return;
    if (!isReadyStatus(bundle.meta.status)) return;
    if (activeTab !== "analysis") return;

    markedReadRef.current = true;
    markSessionRead(sessionId)
      .then(() => refreshIndex().catch(() => {}))
      .catch(() => {});
  }, [bundle?.meta, activeTab, sessionId, refreshIndex]);

  useEffect(() => {
    const sourceLanguage = bundle?.meta?.language;
    if (!sourceLanguage) return;
    setSubtitleLanguage((current) =>
      current === sourceLanguage ? getDefaultSubtitleLanguage(sourceLanguage) : current,
    );
  }, [bundle?.meta?.language, sessionId]);

  if (loading && !bundle) {
    return <LoadingSessionState />;
  }

  if (error || !bundle) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--praxis-text-muted)] gap-3">
        <AlertCircle size={20} className="text-[var(--praxis-danger)]" />
        <p className="text-sm">{error || "Session not found."}</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded border border-[var(--praxis-line-subtle)] px-3 py-2 text-xs text-[var(--praxis-text-primary)] hover:bg-[var(--praxis-bg-panel-raised)]"
            onClick={() => void refreshBundle()}
          >
            Retry
          </button>
          <button
            type="button"
            className="text-xs text-[var(--praxis-text-secondary)] underline hover:text-[var(--praxis-text-primary)]"
            onClick={() => onNavigate("gallery")}
          >
            Back to gallery
          </button>
        </div>
      </div>
    );
  }

  const meta = bundle.meta || {};
  const transcript = bundle.transcript || [];
  const waveform = bundle.waveform || [];
  const subtitleTracks = bundle.subtitles || [];
  const subtitledExports = bundle.subtitled_exports || [];
  const analysis = bundle.analysis;
  const analysisRaw = bundle.analysis_raw_text;
  const isReady = isReadyStatus(meta.status);
  const isVideoOnly = meta.status === "video_only";
  const isReviewable = isReady || isVideoOnly;
  const duration = Number(meta.duration_seconds) || 0;
  const mediaTimelineDuration = mediaDuration > 0 ? mediaDuration : duration;
  const displayDuration =
    mediaDuration > 0
      ? mediaDuration
      : Math.max(duration, Number(transcript.at(-1)?.end_seconds) || 0) || 0;
  const videoSrc = meta.video_filename ? getSessionVideoUrl(sessionId) : null;
  const modelLabel = (meta.processing?.model_used ?? config?.llm?.model ?? config?.openrouter?.default_model ?? "—")
    .split("/")
    .at(-1)
    ?.toUpperCase() ?? "—";

  function handleSeek(seconds) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
    setCurrentTime(seconds);
    startPlaybackTracking();
  }

  async function handleExportPrompt() {
    try {
      const text = await exportSessionPrompt(sessionId);
      await copyText(text);
      pushToast({ kind: "success", message: "Analysis prompt copied to clipboard." });
    } catch (caught) {
      pushToast({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Failed to copy prompt.",
      });
    }
  }

  async function handleExportTranscript() {
    try {
      const text = await exportSessionTranscript(sessionId);
      await copyText(text);
      pushToast({ kind: "success", message: "Transcript copied to clipboard." });
    } catch (caught) {
      pushToast({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Failed to copy transcript.",
      });
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await retrySessionProcessing(sessionId);
      pushToast({ kind: "success", message: "Retry queued." });
      await refreshIndex().catch(() => {});
      await refreshBundle();
    } catch (caught) {
      pushToast({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Failed to retry.",
      });
    } finally {
      setRetrying(false);
    }
  }

  async function handleReanalyze() {
    setReanalyzing(true);
    try {
      const result = await reanalyzeSession(sessionId, {
        llm: {},
      });
      pushToast({
        kind: "success",
        message: `Re-analysis queued${result.model ? ` with ${result.model}` : " using your active AI connection"}.`,
      });
      await refreshIndex().catch(() => {});
      await refreshBundle();
    } catch (caught) {
      pushToast({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Failed to re-analyze.",
      });
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleExportSubtitledVideo() {
    setSubtitleExporting(true);
    try {
      const result = await exportSessionSubtitledVideo(sessionId, subtitleLanguage, secondarySubtitleLanguage || null);
      pushToast({
        kind: "success",
        message: `Exported ${result.filename || "subtitled video"}.`,
      });
      await refreshBundle();
    } catch (caught) {
      pushToast({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Failed to export subtitled video.",
      });
    } finally {
      setSubtitleExporting(false);
    }
  }

  async function handlePracticeUpdate(payload) {
    try {
      await updateSessionPractice(sessionId, payload);
      pushToast({ kind: "success", message: "Practice tracking updated." });
      await refreshBundle();
      await refreshIndex().catch(() => {});
    } catch (caught) {
      pushToast({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Failed to update practice tracking.",
      });
      throw caught;
    }
  }

  async function handleRename(title) {
    const normalized = String(title || "").trim();
    if (!normalized || normalized === meta.title) return;
    try {
      await renameSession(sessionId, normalized);
      await refreshBundle();
      await refreshIndex();
      pushToast({ kind: "success", message: "Session renamed." });
    } catch (caught) {
      pushToast({ kind: "error", message: caught instanceof Error ? caught.message : "Could not rename session." });
    }
  }

  async function handleOpenLocalFiles() {
    const journalFolder = config?.journal_folder;
    if (!journalFolder) {
      pushToast({ kind: "error", message: "Journal folder is not configured." });
      return;
    }
    await openDesktopPath(`${journalFolder.replace(/\/$/, "")}/${sessionId}`);
  }

  return (
    <SessionReviewWorkspace
      meta={meta}
      analysis={analysis}
      analysisRaw={analysisRaw}
      transcript={transcript}
      waveform={waveform}
      currentTime={currentTime}
      duration={mediaTimelineDuration}
      videoSrc={videoSrc}
      videoRef={videoRef}
      subtitleTracks={subtitleTracks.map((track) => ({
        ...track,
        src: getSessionSubtitleUrl(sessionId, track.language, "vtt"),
      }))}
      subtitleExport={{
        language: subtitleLanguage,
        secondaryLanguage: secondarySubtitleLanguage,
        exporting: subtitleExporting,
        sourceLanguage: meta.language,
        onLanguageChange: setSubtitleLanguage,
        onSecondaryLanguageChange: setSecondarySubtitleLanguage,
        onExport: () => void handleExportSubtitledVideo(),
      }}
      sessionId={sessionId}
      onSeek={handleSeek}
      onVideoMetadata={(event) => {
        setMediaDuration(readTimelineDurationFromVideo(event.currentTarget, duration));
        syncPlaybackTime(true);
      }}
      onPlay={startPlaybackTracking}
      onPause={() => {
        syncPlaybackTime(true);
        stopPlaybackTracking();
      }}
      onTimeUpdate={() => syncPlaybackTime()}
      onPracticeUpdate={handlePracticeUpdate}
      onReanalyze={() => void handleReanalyze()}
      reanalyzing={reanalyzing}
      practiceContext={bundle.practice_context}
      onNavigate={onNavigate}
      onBack={() => onNavigate("gallery")}
      onRename={handleRename}
      onOpenLocalFiles={() => void handleOpenLocalFiles()}
      formatTimestamp={formatSecondsTimestamp}
      processingContent={
        isVideoOnly ? (
          <div className="py-8 text-sm leading-6 text-[var(--praxis-text-secondary)]">
            This session is saved as video only. Record another session with transcription enabled to receive a report.
          </div>
        ) : (
          <ProcessingPanel
            meta={meta}
            transcript={transcript}
            analysis={analysis}
            retrying={retrying}
            onRetry={handleRetry}
          />
        )
      }
    />
  );
}
