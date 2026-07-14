import { ArrowLeft, ChevronDown, Pause, SlidersHorizontal, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { deleteSession, finalizeSession } from "../api/sessions.js";
import { useConfig } from "../hooks/useConfig.js";
import { useIndex } from "../hooks/useIndex.js";
import { useRecorder } from "../hooks/useRecorder.js";
import { useToast } from "../hooks/useToast.js";
import {
  isPermissionDeniedError,
  requestRecordingStream,
  stopMediaStream,
} from "../lib/media.js";
import { createBeforeUnloadHandler } from "../lib/recording.js";
import { getRecordShortcutAction } from "../lib/recordShortcuts.js";
import { getPracticeCurrent } from "../api/practice.js";
import { getDiagnosticsChecks } from "../api/diagnostics.js";

const ACTIVE_RECORDER_STATES = new Set(["recording", "paused", "stopping"]);
const DISCARD_CONFIRM_TIMEOUT_MS = 5000;

const LANGUAGE_OPTIONS = [
  { code: "en", label: "EN_US" },
  { code: "fr", label: "FR_FR" },
  { code: "es", label: "ES_ES" },
];

function formatTimer(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function getPermissionMessage(state) {
  if (state === "requesting") return "requesting camera and microphone...";
  if (state === "denied") return "camera or microphone access denied. enable it in system settings.";
  return "press start to open your camera and microphone.";
}

function getStartErrorMessage(error) {
  const fallback = error instanceof Error ? error.message : "Failed to start recording.";
  const normalized = fallback.toLowerCase();
  if (normalized.includes("requested device not found")) return "Camera or microphone device was not found.";
  if (normalized.includes("notreadable")) return "Camera or microphone is busy in another app.";
  return fallback;
}

function getCaptureLabel({ isReview, isPaused, isActive, recorderState }) {
  if (isReview) return "Review Take";
  if (recorderState === "stopping") return "Saving Take";
  if (isPaused) return "Paused";
  if (isActive) return "Recording";
  return "Camera Preview";
}

function getCaptureHint({ isReview, isPaused, isActive, recorderState, permissionState }) {
  if (isReview) return "Watch the take, title it, then choose how much processing to save.";
  if (recorderState === "stopping") return "Finalizing the recording and preparing review.";
  if (isPaused) return "Resume to continue or stop to move this take into review.";
  if (isActive) return "The timer stays inside the preview while capture is running.";
  return getPermissionMessage(permissionState);
}

export function Record({ onNavigate }) {
  const { config } = useConfig();
  const { index, refreshIndex } = useIndex();
  const { pushToast } = useToast();

  const [permissionState, setPermissionState] = useState("idle");
  const [stream, setStream] = useState(null);
  const [language, setLanguage] = useState(config?.language_default ?? "en");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState(null);
  const [reviewTitle, setReviewTitle] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [practice, setPractice] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState([]);
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [goalVisible, setGoalVisible] = useState(true);

  const videoRef = useRef(null);
  const reviewVideoRef = useRef(null);
  const autoFinalizeSessionRef = useRef(null);

  const recorder = useRecorder({
    language,
    stream,
    videoQuality: config?.video_quality ?? "720p",
  });

  const isActive = ACTIVE_RECORDER_STATES.has(recorder.state);
  const isReview = recorder.state === "stopped" && Boolean(recorder.recordedBlobUrl);
  const isIdle = recorder.state === "idle";
  const isPaused = recorder.state === "paused";

  useEffect(() => {
    let active = true;
    void getPracticeCurrent()
      .then((payload) => { if (active) setPractice(payload); })
      .catch(() => { if (active) setPractice(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const mediaDevices = globalThis.navigator?.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return undefined;
    function refreshDevices() {
      return mediaDevices.enumerateDevices().then(setDevices).catch(() => setDevices([]));
    }
    void refreshDevices();
    mediaDevices.addEventListener?.("devicechange", refreshDevices);
    return () => mediaDevices.removeEventListener?.("devicechange", refreshDevices);
  }, []);

  useEffect(() => {
    if (!isActive || !practice?.active_goal?.text) { setGoalVisible(true); return undefined; }
    const timeout = window.setTimeout(() => setGoalVisible(false), 8000);
    return () => window.clearTimeout(timeout);
  }, [isActive, practice?.active_goal?.text]);

  useEffect(() => {
    if (config?.language_default && language !== config.language_default && isIdle) {
      setLanguage(config.language_default);
    }
  }, [config?.language_default]);

  useEffect(() => {
    if (!videoRef.current || !stream) return undefined;
    videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (recorder.state === "stopped" && stream) {
      stopMediaStream(stream);
      setStream(null);
      setPermissionState("idle");
    }
  }, [recorder.state, stream]);

  useEffect(() => {
    if (recorder.state === "idle") {
      setReviewTitle("");
      setActionState("idle");
      setActionError(null);
      setShowDiscardConfirm(false);
    }
  }, [recorder.state, recorder.sessionId]);

  useEffect(() => {
    if (recorder.state !== "stopped" || !recorder.sessionId) return;
    if (autoFinalizeSessionRef.current === recorder.sessionId) return;
    autoFinalizeSessionRef.current = recorder.sessionId;
    void beginProcessing();
  }, [recorder.state, recorder.sessionId]);

  useEffect(() => {
    if (!showDiscardConfirm) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShowDiscardConfirm(false);
    }, DISCARD_CONFIRM_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [showDiscardConfirm]);

  useEffect(() => () => stopMediaStream(stream), [stream]);

  useEffect(() => {
    if (!stream || isReview || !globalThis.AudioContext) { setAudioLevel(0); return undefined; }
    const context = new globalThis.AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.72; source.connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount); let frame = 0; let lastMeterUpdate = 0;
    function measure(now = 0) {
      // A 15 fps meter reads as continuous without rerendering the recording
      // workspace at the display refresh rate.
      if (now - lastMeterUpdate >= 66) {
        analyser.getByteFrequencyData(samples);
        const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
        setAudioLevel(Math.min(1, average / 110));
        lastMeterUpdate = now;
      }
      frame = requestAnimationFrame(measure);
    }
    measure();
    return () => { cancelAnimationFrame(frame); source.disconnect(); void context.close(); setAudioLevel(0); };
  }, [stream, isActive]);

  useEffect(() => {
    if (!isActive) return undefined;
    const handler = createBeforeUnloadHandler(recorder.state);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive, recorder.state]);

  const shortcutHandlersRef = useRef({});
  shortcutHandlersRef.current = {
    handleStart: () => handleStartRecording(),
    handlePause: () => recorder.pauseRecording(),
    handleResume: () => recorder.resumeRecording(),
    handleStop: () => recorder.stopRecording(),
    handleStopForDiscard: () => handleStopForDiscard(),
    handleSave: () => handleFinalize("full"),
    handleDiscard: () => handleDiscard(),
    handleCancelDiscard: () => setShowDiscardConfirm(false),
    handleBack: () => onNavigate("today"),
  };

  useEffect(() => {
    function onKeyDown(event) {
      const action = getRecordShortcutAction({
        event,
        permissionState,
        recorderState: recorder.state,
        showDiscardConfirm,
      });
      if (!action) return;
      event.preventDefault();
      const handlers = shortcutHandlersRef.current;
      if (action === "start") return void handlers.handleStart();
      if (action === "pause") return handlers.handlePause();
      if (action === "resume") return handlers.handleResume();
      if (action === "stop") return void handlers.handleStop();
      if (action === "stop-for-discard") return void handlers.handleStopForDiscard();
      if (action === "save-full") return void handlers.handleSave();
      if (action === "discard") return void handlers.handleDiscard();
      if (action === "cancel-discard") return handlers.handleCancelDiscard();
      if (action === "back") return handlers.handleBack();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [permissionState, recorder.state, showDiscardConfirm]);

  async function handleStartRecording() {
    let nextStream = stream;
    let createdStream = false;
    setActionError(null);

    try {
      try {
        const diagnostics = await getDiagnosticsChecks();
        const disk = diagnostics?.checks?.find((check) => check.name === "free disk space");
        if (disk && !disk.ok) {
          setActionError(`${disk.summary || "Not enough free disk space to record."} ${disk.action || "Free space before recording."}`);
          return;
        }
      } catch {
        // Capture remains available if the optional readiness check is temporarily unavailable.
      }
      if (!nextStream) {
        createdStream = true;
        setPermissionState("requesting");
        nextStream = await requestRecordingStream(undefined, {
          videoQuality: config?.video_quality ?? "720p",
          videoDeviceId,
          audioDeviceId,
        });
        setStream(nextStream);
      }
      setPermissionState("granted");
      await recorder.startRecording({ recordingStream: nextStream });
    } catch (error) {
      if (createdStream && nextStream) {
        stopMediaStream(nextStream);
        setStream(null);
      }
      if (isPermissionDeniedError(error)) {
        setPermissionState("denied");
        setActionError("Camera or microphone access was denied by the system.");
        return;
      }
      setPermissionState("idle");
      setActionError(getStartErrorMessage(error));
    }
  }

  async function startPreview(nextVideoDeviceId = videoDeviceId, nextAudioDeviceId = audioDeviceId) {
    if (!isIdle) return;
    setActionError(null);
    setPermissionState("requesting");
    try {
      const nextStream = await requestRecordingStream(undefined, {
        videoQuality: config?.video_quality ?? "720p",
        videoDeviceId: nextVideoDeviceId,
        audioDeviceId: nextAudioDeviceId,
      });
      if (stream) stopMediaStream(stream);
      setStream(nextStream);
      setPermissionState("granted");
    } catch (error) {
      setPermissionState(isPermissionDeniedError(error) ? "denied" : "idle");
      setActionError(isPermissionDeniedError(error) ? "Camera or microphone access was denied by the system." : getStartErrorMessage(error));
    }
  }

  async function beginProcessing() {
    if (!recorder.sessionId) return;
    setActionState("processing");
    setActionError(null);
    setShowDiscardConfirm(false);
    try {
      await finalizeSession(recorder.sessionId, {
        title: null,
        save_mode: "full",
        duration_seconds: recorder.elapsedSeconds,
      });
      await refreshIndex({ silent: true });
      pushToast({ kind: "success", message: "Saved · local processing started." });
    } catch (error) {
      autoFinalizeSessionRef.current = null;
      setActionState("idle");
      setActionError(error instanceof Error ? error.message : "Failed to start processing.");
    }
  }

  async function handleFinalize(saveMode) {
    if (!recorder.sessionId) return;
    setActionState("saving");
    setActionError(null);
    setShowDiscardConfirm(false);
    try {
      await finalizeSession(recorder.sessionId, {
        title: reviewTitle.trim() || null,
        save_mode: saveMode,
        duration_seconds: recorder.elapsedSeconds,
      });
      await refreshIndex();
      pushToast({
        kind: "success",
        message:
          saveMode === "full"
            ? "Saved · processing started."
            : saveMode === "video_only"
              ? "Saved as raw video."
              : "Saved as transcript only.",
      });
      onNavigate("session", { sessionId: recorder.sessionId });
    } catch (error) {
      setActionState("idle");
      setActionError(error instanceof Error ? error.message : "Failed to finalize recording.");
    }
  }

  async function handleStopForDiscard() {
    try {
      const result = await recorder.stopRecording();
      if (result) {
        setShowDiscardConfirm(true);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to stop recording.");
    }
  }

  async function handleDiscard() {
    if (!recorder.sessionId) {
      onNavigate("today");
      return;
    }

    if (!showDiscardConfirm) {
      setShowDiscardConfirm(true);
      setActionError(null);
      return;
    }

    setActionState("deleting");
    setActionError(null);
    setShowDiscardConfirm(false);
    try {
      await deleteSession(recorder.sessionId);
      await refreshIndex();
      pushToast({ kind: "info", message: "Take discarded." });
      onNavigate("today");
    } catch (error) {
      setActionState("idle");
      setActionError(error instanceof Error ? error.message : "Failed to discard recording.");
    }
  }

  function handleSelectLanguage(code) {
    if (isActive || isReview) return;
    setLanguage(code);
    setShowLangMenu(false);
  }

  const activeLanguage = LANGUAGE_OPTIONS.find((entry) => entry.code === language) ?? LANGUAGE_OPTIONS[0];
  const captureLabel = getCaptureLabel({
    isReview,
    isPaused,
    isActive,
    recorderState: recorder.state,
  });
  const captureHint = getCaptureHint({
    isReview,
    isPaused,
    isActive,
    recorderState: recorder.state,
    permissionState,
  });
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const microphones = devices.filter((device) => device.kind === "audioinput");
  const deviceWarning = devices.length && (!cameras.length || !microphones.length)
    ? !cameras.length && !microphones.length
      ? "No camera or microphone detected. Check system permissions and connections."
      : !cameras.length
        ? "No camera detected. Check system permissions and connections."
        : "No microphone detected. Check system permissions and connections."
    : null;
  const processingSession = index?.sessions?.find((session) => session.id === recorder.sessionId);
  const processingStatus = processingSession?.status || (actionState === "processing" ? "queued" : "saved");
  const processingOrder = ["saved", "transcribing", "analyzing", "ready"];
  const processingIndex = processingStatus === "queued" ? 0
    : processingStatus === "transcribing" ? 1
      : processingStatus === "analyzing" ? 2
        : ["ready", "done"].includes(processingStatus) ? 3 : 0;

  function revealGoal() {
    if (!practice?.active_goal?.text) return;
    setGoalVisible(true);
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[var(--praxis-bg-app)]"
      data-record-mode="stage"
      onPointerMove={revealGoal}
    >
      {/* Compact stage chrome — rail is hidden by App when on this route */}
      <header className="praxis-glass-chrome flex h-12 shrink-0 items-center justify-between border-b border-[var(--praxis-line-subtle)] px-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onNavigate("today")} className="inline-flex h-7 items-center gap-1.5 rounded-[var(--praxis-radius-sm)] px-2 text-xs text-[var(--praxis-text-secondary)] transition-colors hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)]" aria-label="Exit recording">
            <ArrowLeft size={14} /> Exit
          </button>
          <span className="h-4 w-px bg-[var(--praxis-line-subtle)]" aria-hidden="true" />
          <div
            className={
              "inline-flex items-center gap-2 rounded-[var(--praxis-radius-sm)] border px-2.5 py-1 text-[12px] font-medium " +
              (isActive
                ? "border-[var(--praxis-record)]/40 bg-[var(--praxis-danger-soft)] text-[var(--praxis-record)]"
                : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-secondary)]")
            }
          >
            {isActive ? (
              <span className="praxis-record-indicator h-1.5 w-1.5 rounded-full bg-[var(--praxis-record)]" />
            ) : null}
            {captureLabel}
          </div>
          {(isActive || recorder.state === "stopping") ? (
            <span className="font-mono text-sm text-[var(--praxis-text-primary)] tnum">
              {formatTimer(recorder.elapsedSeconds)}
            </span>
          ) : null}
        </div>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLangMenu((value) => !value)}
            disabled={isActive || isReview}
            className="inline-flex items-center gap-2 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 py-1.5 text-xs text-[var(--praxis-text-secondary)] transition-colors hover:text-[var(--praxis-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeLanguage.label}
            <ChevronDown size={14} />
          </button>
          {showLangMenu && !isActive && !isReview ? (
            <div className="praxis-glass-overlay absolute right-0 top-10 z-10 min-w-[140px] rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-strong)] py-1">
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleSelectLanguage(option.code)}
                  className={
                    "w-full px-3 py-1.5 text-left text-xs transition-colors " +
                    (option.code === language
                      ? "bg-[var(--praxis-selected)] text-[var(--praxis-text-primary)]"
                      : "text-[var(--praxis-text-secondary)] hover:bg-[var(--praxis-bg-hover)]")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {practice?.active_goal?.text && !isReview && goalVisible ? (
          <section className="praxis-glass-overlay absolute left-1/2 top-3 z-10 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] px-4 py-3">
            <div className="text-[11px] font-medium text-[var(--praxis-accent)]">Practice this goal</div>
            <p className="mt-1 text-sm font-medium leading-5 text-[var(--praxis-text-primary)]">
              {practice.active_goal.text}
            </p>
            {practice.active_goal.success_criteria?.length ? (
              <p className="mt-1 text-xs text-[var(--praxis-text-secondary)]">
                Success: {practice.active_goal.success_criteria.join(" · ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Centered 16:9 stage */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--praxis-bg-app)] px-4 py-3">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[var(--praxis-radius-md)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-video-surface)] shadow-[var(--praxis-shadow-inset)] aspect-video max-h-[min(70vh,720px)]">
            {isReview ? (
              <video
                ref={reviewVideoRef}
                src={recorder.recordedBlobUrl}
                controls
                autoPlay
                playsInline
                className="h-full w-full object-contain bg-[var(--praxis-video-surface)]"
              />
            ) : permissionState === "granted" && stream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover bg-[var(--praxis-video-surface)]"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--praxis-video-line)] bg-[var(--praxis-video-soft)]">
                  <div className="h-3 w-3 rounded-full bg-[var(--praxis-record)]" />
                </div>
                <span className="text-[12px] font-medium text-[var(--praxis-video-muted)]">
                  {permissionState === "denied" ? "Permission denied" : "Ready"}
                </span>
                <p className="mt-2 max-w-[320px] text-xs text-[var(--praxis-video-faint)]">
                  {getPermissionMessage(permissionState)}
                </p>
              </div>
            )}

            {isActive ? (
              <div className="praxis-video-controls absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-video-line)] px-3 py-2 shadow-[var(--praxis-shadow-overlay)]">
                <span className="text-[11px] text-[var(--praxis-video-muted)]">Mic</span>
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--praxis-video-line)]"
                  role="meter"
                  aria-label="Microphone input level"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(audioLevel * 100)}
                >
                  <div
                    className="h-full origin-left rounded-full bg-[var(--praxis-success)] transition-transform duration-75"
                    style={{ transform: `scaleX(${audioLevel})` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-[var(--praxis-video-muted)]">
                  {recorder.savedChunkCount
                    ? `${recorder.savedChunkCount} chunks · local save`
                    : "Saving locally…"}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <p className="shrink-0 px-4 pb-1 text-center text-[12px] text-[var(--praxis-text-muted)]">
          {captureHint}
        </p>

        {actionError ? (
          <div className="px-4 text-center text-xs text-[var(--praxis-danger)]" role="alert">
            {actionError}
          </div>
        ) : null}
        {deviceWarning && isIdle ? (
          <div className="px-4 text-center text-xs text-[var(--praxis-warning)]" role="status">
            {deviceWarning}
          </div>
        ) : null}
        {recorder.error ? (
          <div className="flex items-center justify-center gap-3 px-4 text-center text-xs text-[var(--praxis-danger)]" role="alert">
            <span>Recording failed: {recorder.error.message}</span>
            <button type="button" onClick={() => void handleStartRecording()} className="rounded border border-[var(--praxis-danger)]/40 px-2 py-1 text-[var(--praxis-danger)]">Retry</button>
          </div>
        ) : null}

        {/* Transport dock */}
        <div className="praxis-glass-chrome shrink-0 border-t border-[var(--praxis-line-subtle)] px-4 py-4">
          {isReview ? (
            <div className="mx-auto flex max-w-4xl flex-col gap-3">
              <div aria-label="Processing status" className="flex items-center gap-2">
                {processingOrder.map((step, stepIndex) => {
                  const active = stepIndex === processingIndex;
                  const complete = stepIndex < processingIndex || processingIndex === processingOrder.length - 1;
                  const label = step === "saved" ? "Saved" : step === "transcribing" ? "Transcribing" : step === "analyzing" ? "Analyzing" : "Ready";
                  return <div key={step} className="flex min-w-0 flex-1 items-center gap-2"><span className={"h-2 w-2 shrink-0 rounded-full " + (complete ? "bg-[var(--praxis-success)]" : active ? "bg-[var(--praxis-accent)]" : "bg-[var(--praxis-disabled)]")} /><span className={"truncate font-mono text-[11px] " + (active || complete ? "text-[var(--praxis-text-primary)]" : "text-[var(--praxis-text-muted)]")}>{label}</span>{stepIndex < processingOrder.length - 1 ? <span className="h-px min-w-3 flex-1 bg-[var(--praxis-line-subtle)]" /> : null}</div>;
                })}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--praxis-bg-elevated)]" aria-hidden="true"><div className="h-full origin-left bg-[var(--praxis-accent)] transition-transform duration-500 ease-[var(--praxis-ease-out)]" style={{ transform: `scaleX(${(processingIndex + 1) / processingOrder.length})` }} /></div>
              {showDiscardConfirm ? (
                <div className="text-[12px] text-[var(--praxis-danger)]">
                  Click confirm discard to delete this take. Cancels automatically in 5s.
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleDiscard()}
                  disabled={actionState === "deleting"}
                  className={
                    "h-10 rounded-[var(--praxis-radius-sm)] px-3 text-[13px] font-medium transition-colors disabled:opacity-50 " +
                    (showDiscardConfirm
                      ? "border border-[var(--praxis-danger)]/40 bg-[var(--praxis-danger-soft)] text-[var(--praxis-danger)]"
                      : "border border-[var(--praxis-line-subtle)] text-[var(--praxis-text-primary)] hover:bg-[var(--praxis-bg-hover)]")
                  }
                >
                  {showDiscardConfirm ? "Confirm Discard" : "Discard"}
                </button>
                {processingStatus === "failed" || processingStatus === "needs_attention" ? <button type="button" onClick={() => { autoFinalizeSessionRef.current = null; void beginProcessing(); }} className="h-10 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] px-3 text-[13px] text-[var(--praxis-text-primary)]">Retry</button> : null}
                {["ready", "done"].includes(processingStatus) ? <button type="button" onClick={() => onNavigate("session", { sessionId: recorder.sessionId })} className="h-10 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent)] px-4 text-[13px] font-medium text-[var(--praxis-on-accent)]">Open report</button> : <span className="px-2 font-mono text-[11px] text-[var(--praxis-text-muted)]">Processing locally…</span>}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex min-h-[56px] max-w-4xl flex-wrap items-center justify-center gap-4">
              {isIdle ? (
                <>
                  <button type="button" onClick={() => void startPreview()} disabled={permissionState === "requesting"} className="inline-flex h-9 items-center gap-2 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-3 text-xs text-[var(--praxis-text-primary)] disabled:opacity-50">
                    {stream ? "Preview active" : "Turn on preview"}
                  </button>
                  <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-[var(--praxis-radius-sm)] px-3 text-xs text-[var(--praxis-text-secondary)] hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)]" aria-expanded={showAdvanced}>
                    <SlidersHorizontal size={14} /> Advanced
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStartRecording()}
                    disabled={permissionState === "requesting"}
                    className="flex h-12 items-center gap-2 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-record)] px-5 text-[13px] font-medium text-[var(--praxis-on-record)] transition-colors hover:brightness-110 disabled:opacity-60"
                    aria-label={permissionState === "denied" ? "Check permissions" : "Start recording"}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--praxis-text-primary)]" />
                    {permissionState === "denied" ? "Check permissions" : "Start recording"}
                  </button>
                  {showAdvanced ? <div className="basis-full mx-auto flex max-w-3xl flex-wrap items-end justify-center gap-3 border-t border-[var(--praxis-line-subtle)] pt-3">
                    <label className="text-[11px] text-[var(--praxis-text-muted)]">Camera<select value={videoDeviceId} onChange={(event) => { const next = event.target.value; setVideoDeviceId(next); void startPreview(next, audioDeviceId); }} className="mt-1 block h-8 min-w-48 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-2 text-xs text-[var(--praxis-text-primary)]"><option value="">System default</option>{cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></label>
                    <label className="text-[11px] text-[var(--praxis-text-muted)]">Microphone<select value={audioDeviceId} onChange={(event) => { const next = event.target.value; setAudioDeviceId(next); void startPreview(videoDeviceId, next); }} className="mt-1 block h-8 min-w-48 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-2 text-xs text-[var(--praxis-text-primary)]"><option value="">System default</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>
                    <div className="w-28"><div className="text-[11px] text-[var(--praxis-text-muted)]">Input level</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--praxis-bg-elevated)]"><div className="h-full origin-left bg-[var(--praxis-success)]" style={{ transform: `scaleX(${Math.max(0.03, audioLevel)})` }} /></div></div>
                    <p className="basis-full text-center text-[11px] text-[var(--praxis-text-muted)]">{config?.video_quality ?? "720p"} · speech processing, echo cancellation, and local chunk saving are enabled.</p>
                  </div> : null}
                </>
              ) : null}

              {recorder.state === "recording" ? (
                <>
                  <button
                    type="button"
                    onClick={() => recorder.pauseRecording()}
                    className="flex h-10 w-10 items-center justify-center rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] text-[var(--praxis-text-primary)] hover:bg-[var(--praxis-bg-hover)]"
                    aria-label="Pause"
                  >
                    <Pause size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void recorder.stopRecording()}
                    className="flex h-11 items-center gap-2 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-record)] px-5 text-[13px] font-medium text-[var(--praxis-on-record)] hover:brightness-110"
                    aria-label="Stop"
                  >
                    <Square fill="currentColor" size={14} />
                    Stop
                  </button>
                </>
              ) : null}

              {isPaused ? (
                <>
                  <button
                    type="button"
                    onClick={() => recorder.resumeRecording()}
                    className="flex h-10 items-center gap-2 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-elevated)] px-4 text-[13px] font-medium text-[var(--praxis-record)] hover:bg-[var(--praxis-bg-hover)]"
                    aria-label="Resume"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--praxis-record)]" />
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => void recorder.stopRecording()}
                    className="flex h-11 items-center gap-2 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-record)] px-5 text-[13px] font-medium text-[var(--praxis-on-record)] hover:brightness-110"
                    aria-label="Stop"
                  >
                    <Square fill="currentColor" size={14} />
                    Stop
                  </button>
                </>
              ) : null}

              {recorder.state === "stopping" ? (
                <span className="text-[13px] text-[var(--praxis-text-muted)]">Saved · preparing review…</span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
