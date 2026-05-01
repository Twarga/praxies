import { ArrowLeft, ChevronDown, Pause, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { deleteSession, finalizeSession } from "../api/sessions.js";
import { useConfig } from "../hooks/useConfig.js";
import { useIndex } from "../hooks/useIndex.js";
import { useRecorder } from "../hooks/useRecorder.js";
import { useToast } from "../hooks/useToast.js";
import {
  isPermissionDeniedError,
  playReadySound,
  requestRecordingStream,
  stopMediaStream,
} from "../lib/media.js";
import { createBeforeUnloadHandler } from "../lib/recording.js";
import { getRecordShortcutAction } from "../lib/recordShortcuts.js";

const ACTIVE_RECORDER_STATES = new Set(["recording", "paused", "stopping"]);

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
  const { refreshIndex } = useIndex();
  const { pushToast } = useToast();

  const [permissionState, setPermissionState] = useState("idle");
  const [stream, setStream] = useState(null);
  const [language, setLanguage] = useState(config?.language_default ?? "en");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState(null);
  const [reviewTitle, setReviewTitle] = useState("");

  const videoRef = useRef(null);
  const reviewVideoRef = useRef(null);

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
    }
  }, [recorder.state, recorder.sessionId]);

  useEffect(() => () => stopMediaStream(stream), [stream]);

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
    handleSave: () => handleFinalize("full"),
    handleDiscard: () => handleDiscard(),
    handleBack: () => onNavigate("today"),
  };

  useEffect(() => {
    function onKeyDown(event) {
      const action = getRecordShortcutAction({
        event,
        permissionState,
        recorderState: recorder.state,
        showDiscardConfirm: false,
      });
      if (!action) return;
      event.preventDefault();
      const handlers = shortcutHandlersRef.current;
      if (action === "start") return void handlers.handleStart();
      if (action === "pause") return handlers.handlePause();
      if (action === "resume") return handlers.handleResume();
      if (action === "stop") return void handlers.handleStop();
      if (action === "save-full") return void handlers.handleSave();
      if (action === "discard") return void handlers.handleDiscard();
      if (action === "back") return handlers.handleBack();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [permissionState, recorder.state]);

  async function handleStartRecording() {
    let nextStream = stream;
    let createdStream = false;
    setActionError(null);

    try {
      if (!nextStream) {
        createdStream = true;
        setPermissionState("requesting");
        nextStream = await requestRecordingStream(undefined, {
          videoQuality: config?.video_quality ?? "720p",
        });
        setStream(nextStream);
      }
      setPermissionState("granted");
      await recorder.startRecording({ recordingStream: nextStream });
      if (config?.ready_sound_enabled) void playReadySound().catch(() => {});
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

  async function handleFinalize(saveMode) {
    if (!recorder.sessionId) return;
    setActionState("saving");
    setActionError(null);
    try {
      await finalizeSession(recorder.sessionId, {
        title: reviewTitle.trim() || null,
        save_mode: saveMode,
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

  async function handleDiscard() {
    if (!recorder.sessionId) {
      onNavigate("today");
      return;
    }
    setActionState("saving");
    setActionError(null);
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

  return (
    <div className="flex flex-col h-full bg-[#0F1012] overflow-hidden">
      <header className="h-16 border-b border-[#2A2C31] flex items-center px-8 bg-[#151619] shrink-0 justify-between">
        <div className="flex items-center gap-3 relative">
          <button
            type="button"
            onClick={() => onNavigate("today")}
            className="px-3 py-1.5 bg-[#1C1D21] border border-[#2A2C31] rounded flex items-center gap-2 text-xs font-mono uppercase text-[#E0E0E0] hover:bg-[#2A2C31] transition-colors"
            aria-label="Back to today"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="px-2 py-0.5 rounded bg-[#2A2C31] text-[#E0E0E0] text-[10px] font-mono uppercase tracking-widest">
            {captureLabel}
          </div>
        </div>

        <div className="flex items-center gap-3 relative">
          <button
            type="button"
            onClick={() => setShowLangMenu((value) => !value)}
            disabled={isActive || isReview}
            className="px-3 py-1.5 bg-[#1C1D21] border border-[#2A2C31] rounded flex items-center gap-2 text-xs font-mono uppercase text-[#E0E0E0] hover:bg-[#2A2C31] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activeLanguage.label}
            <ChevronDown size={14} />
          </button>
          {showLangMenu && !isActive && !isReview ? (
            <div className="absolute top-12 right-0 z-10 min-w-[140px] bg-[#1C1D21] border border-[#2A2C31] rounded shadow-xl py-1">
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleSelectLanguage(option.code)}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition-colors ${
                    option.code === language
                      ? "text-white bg-[#2A2C31]"
                      : "text-[#E0E0E0] opacity-70 hover:opacity-100 hover:bg-[#2A2C31]/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="bg-[#151619] border border-[#2A2C31] rounded-lg p-5">
            <div className="flex items-start justify-between gap-6 mb-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  {isReview ? "Review Recording" : "Capture Session"}
                </h2>
                <p className="mt-1 text-xs text-[#D1D1D1] opacity-70 max-w-[520px]">
                  {captureHint}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#2A2C31] overflow-hidden bg-black">
              <div className="relative aspect-video min-h-[420px] lg:min-h-[560px] flex items-center justify-center">
                {isReview ? (
                  <video
                    ref={reviewVideoRef}
                    src={recorder.recordedBlobUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : permissionState === "granted" && stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover bg-black"
                  />
                ) : (
                  <div className="flex flex-col items-center text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                      <div className="w-3 h-3 rounded-full bg-[#F27D26]" />
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.2em] opacity-60 text-white">
                      {permissionState === "denied" ? "permission denied" : "ready"}
                    </span>
                    <p className="mt-2 text-xs text-[#D1D1D1] opacity-70 max-w-[320px]">
                      {getPermissionMessage(permissionState)}
                    </p>
                  </div>
                )}

                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-[#151619]/90 border border-[#2A2C31] rounded text-[10px] font-mono uppercase tracking-widest text-[#E0E0E0]">
                    {captureLabel}
                  </div>
                  {(isActive || recorder.state === "stopping") && (
                    <div className="px-3 py-1.5 bg-[#151619]/90 border border-[#2A2C31] rounded">
                      <span className="font-mono text-sm text-white tracking-wider tnum">
                        {formatTimer(recorder.elapsedSeconds)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {actionError ? (
            <div className="text-xs text-red-400 font-mono uppercase tracking-widest" role="alert">
              {actionError}
            </div>
          ) : null}
          {recorder.error ? (
            <div className="text-xs text-red-400 font-mono uppercase tracking-widest" role="alert">
              {recorder.error.message}
            </div>
          ) : null}

          {isReview ? (
            <div className="bg-[#151619] border border-[#2A2C31] rounded-lg p-5 flex flex-col gap-4">
              <input
                type="text"
                value={reviewTitle}
                onChange={(event) => setReviewTitle(event.target.value)}
                placeholder="Title this take"
                className="w-full bg-[#1C1D21] border border-[#2A2C31] rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#4ADE80]"
                aria-label="Recording title"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => void handleDiscard()}
                  disabled={actionState !== "idle"}
                  className="h-11 px-4 bg-transparent border border-[#2A2C31] hover:bg-[#1C1D21] text-white rounded text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => void handleFinalize("video_only")}
                  disabled={actionState !== "idle"}
                  className="h-11 px-4 bg-[#1C1D21] border border-[#2A2C31] hover:bg-[#2A2C31] text-white rounded text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  Save Raw
                </button>
                <button
                  type="button"
                  onClick={() => void handleFinalize("transcribe_only")}
                  disabled={actionState !== "idle"}
                  className="h-11 px-4 bg-[#1C1D21] border border-[#2A2C31] hover:bg-[#2A2C31] text-white rounded text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  Transcript Only
                </button>
                <button
                  type="button"
                  onClick={() => void handleFinalize("full")}
                  disabled={actionState !== "idle"}
                  className="h-11 px-4 bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-black rounded text-xs font-semibold uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(74,222,128,0.2)] disabled:opacity-60"
                >
                  {actionState === "saving" ? "Processing..." : "Process & Analyze"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#151619] border border-[#2A2C31] rounded-lg p-5">
              <div className="flex items-center justify-center gap-6 min-h-[72px]">
                {isIdle ? (
                  <button
                    type="button"
                    onClick={() => void handleStartRecording()}
                    disabled={permissionState === "requesting"}
                    className="w-12 h-12 rounded-full bg-[#F27D26] hover:bg-[#F27D26]/90 flex items-center justify-center transition-transform hover:scale-105 shadow-[0_0_15px_rgba(242,125,38,0.3)] disabled:opacity-60"
                    aria-label="Start recording"
                  >
                    <div className="w-4 h-4 bg-white rounded-full" />
                  </button>
                ) : null}

                {recorder.state === "recording" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => recorder.pauseRecording()}
                      className="w-10 h-10 rounded-full bg-[#1C1D21] border border-[#2A2C31] hover:bg-[#2A2C31] flex items-center justify-center text-white transition-colors"
                      aria-label="Pause"
                    >
                      <Pause size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void recorder.stopRecording()}
                      className="w-12 h-12 rounded-full bg-[#2A2C31] border border-[#32353B] hover:bg-[#32353B] flex items-center justify-center transition-colors"
                      aria-label="Stop"
                    >
                      <Square fill="currentColor" size={16} className="text-white" />
                    </button>
                  </>
                ) : null}

                {isPaused ? (
                  <>
                    <button
                      type="button"
                      onClick={() => recorder.resumeRecording()}
                      className="w-10 h-10 rounded-full bg-[#1C1D21] border border-[#2A2C31] hover:bg-[#2A2C31] flex items-center justify-center text-[#F27D26] transition-colors"
                      aria-label="Resume"
                    >
                      <div className="w-3 h-3 rounded-full bg-[#F27D26]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void recorder.stopRecording()}
                      className="w-12 h-12 rounded-full bg-[#2A2C31] border border-[#32353B] hover:bg-[#32353B] flex items-center justify-center transition-colors"
                      aria-label="Stop"
                    >
                      <Square fill="currentColor" size={16} className="text-white" />
                    </button>
                  </>
                ) : null}

                {recorder.state === "stopping" ? (
                  <span className="text-xs font-mono uppercase tracking-widest opacity-60 text-white">
                    Saving take...
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
