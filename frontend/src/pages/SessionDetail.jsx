import {
  AlertCircle,
  ArrowLeft,
  Captions,
  Clock,
  Copy,
  Download,
  Loader2,
  RotateCcw,
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
  retrySessionProcessing,
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

function buildFallbackWaveformBars(segments, duration, count = 72) {
  if (!segments || segments.length === 0) {
    return Array.from({ length: count }, (_, index) => 0.22 + ((index % 5) * 0.04));
  }

  const totalDuration =
    Math.max(
      Number(duration) || 0,
      Number(segments.at(-1)?.end_seconds) || 0,
      1,
    ) || 1;

  return Array.from({ length: count }, (_, index) => {
    const time = (index / count) * totalDuration;
    const segment = segments.find(
      (entry) =>
        Number(entry.start_seconds) <= time && Number(entry.end_seconds) >= time,
    );
    const textLength = segment?.text?.length ?? 0;
    return clamp01(0.18 + ((textLength % 24) / 24) * 0.72);
  });
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
  if (level === "success") return "text-[#4ADE80]";
  if (level === "warning") return "text-[#F27D26]";
  if (level === "error") return "text-red-400";
  return "text-[#D1D1D1]";
}

function Waveform({ bars, segments, currentTime, duration, onSeek }) {
  const waveformBars = useMemo(() => {
    if (Array.isArray(bars) && bars.length > 0) {
      return bars.map((value) => clamp01(value));
    }
    return buildFallbackWaveformBars(segments, duration);
  }, [bars, segments, duration]);

  const safeDuration = normalizeMediaDuration(Number(duration));
  const transcriptDuration = Math.max(Number(segments?.at(-1)?.end_seconds) || 0, 0);
  const playedRatio = safeDuration > 0 ? Math.min(1, currentTime / safeDuration) : 0;
  const displayedDuration = safeDuration > 0 ? safeDuration : transcriptDuration;

  return (
    <div className="h-24 bg-[#151619] p-4 flex flex-col justify-between border-t border-[#2A2C31]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
          Voice waveform
        </span>
        <span className="text-[10px] font-mono opacity-50 tnum">
          {formatSecondsTimestamp(currentTime)} / {formatSecondsTimestamp(displayedDuration)}
        </span>
      </div>
      <button
        type="button"
        onClick={(event) => {
          if (!safeDuration) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          onSeek(Math.max(0, Math.min(1, ratio)) * safeDuration);
        }}
        className="relative flex items-end gap-[2px] h-10 w-full"
        aria-label="Seek"
      >
        {waveformBars.map((height, index) => {
          const ratio = (index + 0.5) / waveformBars.length;
          const active = ratio <= playedRatio;
          return (
            <div
              key={index}
              className={`flex-1 rounded-t-sm transition-colors ${
                active ? "bg-white" : "bg-white/30"
              }`}
              style={{ height: `${18 + height * 82}%` }}
            />
          );
        })}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-[#4ADE80]/90 shadow-[0_0_12px_rgba(74,222,128,0.45)]"
          style={{ left: `calc(${playedRatio * 100}% - 0.5px)` }}
        />
      </button>
    </div>
  );
}

function PipelineStep({ step, meta }) {
  const tone = getProcessingStepTone(step, meta);
  const toneClass =
    tone === "done"
      ? "border-[#4ADE80]/40 bg-[#1C3E2F] text-[#4ADE80]"
      : tone === "active"
        ? "border-[#F27D26]/40 bg-[#F27D26]/10 text-[#F27D26]"
        : "border-[#2A2C31] bg-[#1C1D21] text-[#D1D1D1]";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-60">{step.kicker}</div>
      <div className="mt-1 text-sm font-medium">{step.label}</div>
    </div>
  );
}

function ProcessingPanel({ meta, transcript, analysis, retrying, onRetry }) {
  const processing = meta?.processing || {};
  const progressPercent = getProcessingPercent(meta?.status, processing);
  const progressLabel = getProcessingLabel(meta?.status, processing, meta?.save_mode);
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
      <div className="rounded-lg border border-[#2A2C31] bg-[#1C1D21] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">
              Live pipeline
            </div>
            <h3 className="mt-2 text-lg font-semibold text-white">{progressLabel}</h3>
            <p className="mt-2 text-sm text-[#D1D1D1] opacity-75 max-w-xl">
              The recording is already saved. Whisper transcription and AI review continue in the
              background while this page streams the latest state.
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-[#2A2C31] bg-[#0F1012] px-3 py-2 text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">Progress</div>
            <div className="mt-1 text-2xl font-light tnum text-white">{progressPercent}%</div>
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-[#0F1012] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#F27D26] via-[#F4B26D] to-[#4ADE80] transition-[width] duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className={`mt-4 grid gap-3 ${steps.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {steps.map((step) => (
            <PipelineStep key={step.id} step={step} meta={meta} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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

      <div className="rounded-lg border border-[#2A2C31] bg-[#1C1D21] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">
              Mini terminal
            </div>
            <div className="mt-1 text-sm text-[#D1D1D1] opacity-75">
              Stage-by-stage output from the local processing pipeline.
            </div>
          </div>
          {isAttentionStatus(meta?.status) ? (
            <button
              type="button"
              disabled={retrying}
              onClick={() => void onRetry()}
              className="px-3 py-2 bg-[#F27D26]/20 hover:bg-[#F27D26]/30 border border-[#F27D26]/40 text-[#F27D26] rounded text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-60"
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

        <div className="mt-4 rounded-lg border border-[#2A2C31] bg-[#0A0B0D] px-4 py-3 font-mono text-[11px] leading-6">
          {terminalLines.length === 0 ? (
            <div className="text-[#A0A0A0] opacity-70">Waiting for the backend to emit processing logs.</div>
          ) : (
            terminalLines.map((line, index) => (
              <div key={`${line.created_at}-${index}`} className="grid grid-cols-[70px_1fr] gap-3">
                <span className="text-[#7E8086]">{formatTerminalTimestamp(line.created_at)}</span>
                <span className={getTerminalLineTone(line.level)}>{line.message}</span>
              </div>
            ))
          )}
        </div>

        {meta?.error ? (
          <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {meta.error}
          </div>
        ) : null}
      </div>

      {transcript.length > 0 ? (
        <div className="rounded-lg border border-[#2A2C31] bg-[#1C1D21] p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">
            Transcript preview
          </div>
          <div className="mt-3 space-y-2">
            {transcript.slice(0, 4).map((segment, index) => (
              <div
                key={`${segment.start_seconds}-${index}`}
                className="rounded border border-[#2A2C31] bg-[#151619] px-3 py-2 text-sm text-[#D1D1D1]"
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

function ListBlock({ title, items, accent }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className={`p-3 bg-[#1C1D21] border-l-2 text-sm text-[#E0E0E0] ${
              accent === "accent"
                ? "border-[#4ADE80]"
                : accent === "danger"
                  ? "border-red-500"
                  : "border-[#F27D26]"
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PatternsHitTodayBlock({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Patterns Hit Today
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#F27D26]">
          {items.length} hit{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={`patterns-hit-today-${index}`}
            className="p-3 bg-[#1C1D21] border-l-2 border-[#F27D26] text-sm text-[#E0E0E0]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBlock({ label, value }) {
  return (
    <div className="p-4 bg-[#1C1D21] border border-[#2A2C31] rounded-lg">
      <div className="text-[10px] opacity-40 uppercase mb-1 font-mono tracking-widest">
        {label}
      </div>
      <div className="text-sm font-medium mt-2 text-[#E0E0E0] leading-relaxed">{value}</div>
    </div>
  );
}

function FillerWords({ map }) {
  const entries = Object.entries(map || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([word, count]) => (
        <span
          key={word}
          className="px-2 py-1 rounded bg-[#1C1D21] border border-[#2A2C31] text-xs text-[#D1D1D1] font-mono"
        >
          {word} <span className="opacity-50">.{count}</span>
        </span>
      ))}
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
  const [subtitleLanguage, setSubtitleLanguage] = useState("fr");
  const [subtitleExporting, setSubtitleExporting] = useState(false);
  const videoRef = useRef(null);
  const markedReadRef = useRef(false);
  const playbackFrameRef = useRef(null);
  const playbackFrameModeRef = useRef("raf");

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

  function syncPlaybackTime() {
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
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#E0E0E0] opacity-60">
        <Clock size={20} className="animate-pulse" />
        <p className="mt-2 text-xs uppercase tracking-widest">Loading session...</p>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#E0E0E0] opacity-70 gap-3">
        <AlertCircle size={20} className="text-red-400" />
        <p className="text-sm">{error || "Session not found."}</p>
        <button
          type="button"
          className="text-xs text-white underline opacity-80 hover:opacity-100"
          onClick={() => onNavigate("gallery")}
        >
          Back to gallery
        </button>
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
  const modelLabel = (meta.processing?.model_used ?? config?.openrouter?.default_model ?? "—")
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

  async function handleExportSubtitledVideo() {
    setSubtitleExporting(true);
    try {
      const result = await exportSessionSubtitledVideo(sessionId, subtitleLanguage);
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

  return (
    <div className="flex flex-col h-full bg-[#0F1012]">
      <header className="h-16 border-b border-[#2A2C31] flex items-center justify-between px-8 shrink-0 bg-[#151619] gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate("gallery")}
            className="p-1 hover:bg-[#2A2C31] rounded text-[#E0E0E0] opacity-60 hover:opacity-100 transition-colors"
            aria-label="Back to gallery"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-4 w-px bg-[#2A2C31]" />
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-white truncate">
              {getSessionTitle(meta)}
            </h1>
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest ${getStatusBadgeStyle(
                meta.status,
              )}`}
            >
              {getStatusLabel(meta.status)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] opacity-40 uppercase tracking-tighter font-mono">Duration</div>
            <div className="text-sm font-mono tnum">{formatDuration(displayDuration)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] opacity-40 uppercase tracking-tighter font-mono">Date</div>
            <div className="text-sm font-mono">{formatLongDate(meta.created_at)}</div>
          </div>
          {isReady && transcript.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleExportTranscript()}
              className="px-3 py-2 bg-[#2A2C31] hover:bg-[#32353B] rounded text-xs font-medium transition-colors flex items-center gap-2"
              title="Copy transcript"
            >
              <Copy size={14} />
              Transcript
            </button>
          ) : null}
          {isReady && transcript.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleExportPrompt()}
              className="px-3 py-2 bg-[#2A2C31] hover:bg-[#32353B] rounded text-xs font-medium transition-colors flex items-center gap-2"
              title="Copy analysis prompt"
            >
              <Download size={14} />
              Prompt
            </button>
          ) : null}
          {isReady && transcript.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                value={subtitleLanguage}
                onChange={(event) => setSubtitleLanguage(event.target.value)}
                disabled={subtitleExporting}
                className="px-2 py-2 bg-[#1C1D21] border border-[#2A2C31] rounded text-[10px] font-mono uppercase tracking-widest text-[#E0E0E0] focus:outline-none focus:border-[#4ADE80] disabled:opacity-60"
                aria-label="Subtitle language"
              >
                {SUBTITLE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleExportSubtitledVideo()}
                disabled={subtitleExporting}
                className="px-3 py-2 bg-[#2A2C31] hover:bg-[#32353B] rounded text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
                title={
                  subtitledExports.some((entry) => entry.language === subtitleLanguage)
                    ? `Re-export ${subtitleLanguage.toUpperCase()} subtitled MP4`
                    : "Export subtitled MP4"
                }
              >
                <Captions size={14} />
                {subtitleExporting ? "Exporting..." : "Subtitled MP4"}
              </button>
            </div>
          ) : null}
          {isAttentionStatus(meta.status) ? (
            <button
              type="button"
              disabled={retrying}
              onClick={() => void handleRetry()}
              className="px-3 py-2 bg-[#F27D26]/20 hover:bg-[#F27D26]/30 border border-[#F27D26]/40 text-[#F27D26] rounded text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <RotateCcw size={14} />
              {retrying ? "Retrying..." : "Retry"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <section className="w-[540px] border-r border-[#2A2C31] bg-[#0A0B0D] flex flex-col shrink-0">
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                crossOrigin="anonymous"
                controls
                playsInline
                className="w-full h-full object-contain bg-black"
                onLoadedMetadata={(event) => {
                  setMediaDuration(readTimelineDurationFromVideo(event.currentTarget, duration));
                  syncPlaybackTime();
                }}
                onDurationChange={(event) => {
                  setMediaDuration(readTimelineDurationFromVideo(event.currentTarget, duration));
                }}
                onProgress={(event) => {
                  setMediaDuration(readTimelineDurationFromVideo(event.currentTarget, duration));
                }}
                onPlay={() => startPlaybackTracking()}
                onPause={() => {
                  syncPlaybackTime();
                  stopPlaybackTracking();
                }}
                onEnded={() => {
                  syncPlaybackTime();
                  stopPlaybackTracking();
                }}
                onSeeking={() => syncPlaybackTime()}
                onSeeked={() => syncPlaybackTime()}
                onTimeUpdate={() => syncPlaybackTime()}
              >
                {subtitleTracks.map((track) => (
                  <track
                    key={track.language}
                    kind="subtitles"
                    src={getSessionSubtitleUrl(sessionId, track.language, "vtt")}
                    srcLang={track.language}
                    label={track.language.toUpperCase()}
                    default={track.language === meta.language}
                  />
                ))}
              </video>
            ) : (
              <div className="flex flex-col items-center text-center px-6">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1" />
                </div>
                <span className="mt-4 text-[11px] uppercase tracking-[0.2em] opacity-40">
                  No video stored
                </span>
              </div>
            )}
          </div>
          <Waveform
            bars={waveform}
            segments={transcript}
            currentTime={currentTime}
            duration={mediaTimelineDuration}
            onSeek={handleSeek}
          />
        </section>

        <section className="flex-1 flex flex-col bg-[#151619] min-w-0">
          <div className="h-12 border-b border-[#2A2C31] flex shrink-0">
            {[
              { id: "analysis", label: "Analysis" },
              { id: "transcript", label: "Transcript" },
              { id: "raw", label: "Raw Notes" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-white text-white"
                    : "opacity-40 hover:opacity-100 text-[#E0E0E0]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 praxis-fade-in" key={activeTab}>
            {!isReviewable ? (
              <ProcessingPanel
                meta={meta}
                transcript={transcript}
                analysis={analysis}
                retrying={retrying}
                onRetry={handleRetry}
              />
            ) : (
              <>
                {activeTab === "transcript" ? (
                  transcript.length === 0 ? (
                    <p className="text-xs font-mono opacity-50 uppercase tracking-widest">
                      No transcript stored for this session.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {transcript.map((segment, index) => {
                        const start = Number(segment.start_seconds) || 0;
                        const end = Number(segment.end_seconds) || start;
                        const isActive =
                          currentTime >= start &&
                          currentTime < (end || Number.POSITIVE_INFINITY);
                        return (
                          <button
                            key={`${start}-${index}`}
                            type="button"
                            onClick={() => handleSeek(start)}
                            className={`w-full flex gap-4 p-2 rounded transition-colors group cursor-pointer text-left ${
                              isActive ? "bg-[#2A2C31]" : "hover:bg-[#1C1D21]"
                            }`}
                          >
                            <div
                              className={`w-12 text-[10px] font-mono pt-0.5 tnum ${
                                isActive
                                  ? "text-[#4ADE80]"
                                  : "opacity-40 group-hover:opacity-100"
                              }`}
                            >
                              {formatSecondsTimestamp(start)}
                            </div>
                            <div
                              className={`flex-1 text-sm leading-relaxed ${
                                isActive
                                  ? "text-white"
                                  : "text-[#D1D1D1] group-hover:text-white"
                              } transition-colors`}
                            >
                              {segment.text}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : null}

                {activeTab === "analysis" ? (
                  analysis ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
                            Verdict
                          </h3>
                        </div>
                        <p className="text-base leading-relaxed text-[#E0E0E0] italic border-l-2 border-[#F27D26] pl-4">
                          "{analysis.prose_verdict}"
                        </p>
                        {analysis.session_summary ? (
                          <p className="text-sm text-[#D1D1D1] opacity-80 leading-relaxed">
                            {analysis.session_summary}
                          </p>
                        ) : null}
                      </div>

                      {analysis.main_topics?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {analysis.main_topics.map((topic) => (
                            <span
                              key={topic}
                              className="px-2 py-1 rounded bg-[#1C1D21] border border-[#2A2C31] text-xs text-[#D1D1D1]"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-4">
                        <StatBlock
                          label="Speaking Quality"
                          value={
                            <>
                              <div>Clarity: {analysis.speaking_quality?.clarity ?? "-"}/10</div>
                              <div className="opacity-70 mt-1">
                                Pace: {analysis.speaking_quality?.pace ?? "-"}
                              </div>
                              <div className="opacity-70 mt-1">
                                Structure: {analysis.speaking_quality?.structure ?? "-"}
                              </div>
                            </>
                          }
                        />
                        <StatBlock
                          label="Language Fluency"
                          value={
                            <>
                              <div>
                                Score: {analysis.grammar_and_language?.fluency_score ?? "-"}/10
                              </div>
                              <div className="opacity-70 mt-1">
                                Vocab: {analysis.grammar_and_language?.vocabulary_level ?? "-"}
                              </div>
                              <div className="opacity-70 mt-1">
                                Errors: {analysis.grammar_and_language?.errors?.length ?? 0}
                              </div>
                            </>
                          }
                        />
                      </div>

                      {analysis.speaking_quality?.executive_presence_notes ? (
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">
                            Executive Presence
                          </h3>
                          <p className="text-sm text-[#E0E0E0] leading-relaxed bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-4">
                            {analysis.speaking_quality.executive_presence_notes}
                          </p>
                        </div>
                      ) : null}

                      {Object.keys(analysis.grammar_and_language?.filler_words || {}).length ? (
                        <div className="flex flex-col gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
                            Filler Words
                          </h3>
                          <FillerWords map={analysis.grammar_and_language.filler_words} />
                        </div>
                      ) : null}

                      {analysis.grammar_and_language?.errors?.length ? (
                        <div className="flex flex-col gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
                            Grammar Errors
                          </h3>
                          <div className="space-y-2">
                            {analysis.grammar_and_language.errors.map((err, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleSeek(err.timestamp_seconds)}
                                className="w-full p-3 bg-[#1C1D21] border-l-2 border-red-500 hover:bg-[#2A2C31] transition-colors text-left flex items-start gap-3"
                              >
                                <span className="text-[10px] font-mono opacity-50 mt-0.5 tnum">
                                  {formatSecondsTimestamp(err.timestamp_seconds)}
                                </span>
                                <div className="flex-1">
                                  <div className="text-sm text-[#E0E0E0]">
                                    <span className="line-through opacity-60">{err.said}</span>{" "}
                                    {"->"} <span className="text-[#4ADE80]">{err.correct}</span>
                                  </div>
                                  <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest mt-1">
                                    {err.type}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <ListBlock
                        title="Strong Points"
                        items={analysis.ideas_and_reasoning?.strong_points}
                        accent="accent"
                      />
                      <ListBlock
                        title="Weak Points"
                        items={analysis.ideas_and_reasoning?.weak_points}
                        accent="warning"
                      />
                      <ListBlock
                        title="Logical Flaws"
                        items={analysis.ideas_and_reasoning?.logical_flaws}
                        accent="danger"
                      />
                      <ListBlock
                        title="Factual Errors"
                        items={analysis.ideas_and_reasoning?.factual_errors}
                        accent="danger"
                      />

                      {analysis.ideas_and_reasoning?.philosophical_pushback ? (
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">
                            Philosophical Pushback
                          </h3>
                          <p className="text-sm text-[#E0E0E0] leading-relaxed bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-4 italic">
                            {analysis.ideas_and_reasoning.philosophical_pushback}
                          </p>
                        </div>
                      ) : null}

                      <PatternsHitTodayBlock items={analysis.recurring_patterns_hit} />
                      <ListBlock
                        title="Action Items"
                        items={analysis.actionable_improvements}
                        accent="accent"
                      />
                    </>
                  ) : (
                    <p className="text-xs font-mono opacity-50 uppercase tracking-widest">
                      {isVideoOnly ? "Video-only save. No transcript or analysis was requested." : "No analysis stored yet."}
                    </p>
                  )
                ) : null}

                {activeTab === "raw" ? (
                  <div className="p-4 bg-[#1C1D21] border border-[#2A2C31] rounded-lg">
                    <pre className="text-[11px] text-[#A0A0A0] font-mono whitespace-pre-wrap break-words">
                      {analysisRaw
                        ? analysisRaw
                        : analysis
                          ? JSON.stringify(analysis, null, 2)
                          : "No raw output stored."}
                    </pre>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="h-8 border-t border-[#2A2C31] bg-[#0A0B0D] px-4 flex items-center justify-between text-[10px] font-mono opacity-60 shrink-0 uppercase tracking-widest">
        <div className="flex gap-4">
          <span>Engine: {modelLabel}</span>
          <span>Mode: Local-first</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
          Node Active
        </div>
      </footer>
    </div>
  );
}
