import { useEffect, useRef, useState } from "react";
import { createSession, getSessionVideoUrl, prepareSessionPreview, uploadSessionChunk } from "../api/sessions.js";
import { getRecordingProfile } from "../lib/media.js";

const PREFERRED_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
const FALLBACK_MIME_TYPE = "video/webm";
const AUDIO_BITRATE = 128_000;
const CHUNK_INTERVAL_MS = 5000;

export function getRecorderOptions(
  videoQuality = "720p",
  MediaRecorderClass = globalThis.MediaRecorder,
) {
  const profile = getRecordingProfile(videoQuality);
  const mimeType =
    PREFERRED_MIME_TYPES.find((candidate) => MediaRecorderClass?.isTypeSupported?.(candidate)) ??
    FALLBACK_MIME_TYPE;

  return {
    mimeType,
    audioBitsPerSecond: AUDIO_BITRATE,
    videoBitsPerSecond: profile.videoBitsPerSecond,
  };
}

export function useRecorder({ language, stream, videoQuality }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState("idle");
  const [savedChunkCount, setSavedChunkCount] = useState(0);

  const accumulatedMsRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const reviewBlobUrlRef = useRef(null);
  const sessionIdRef = useRef(null);
  const startedAtRef = useRef(null);
  const stopPromiseRef = useRef(null);
  const stopResolverRef = useRef(null);
  const stopRejecterRef = useRef(null);
  const timerRef = useRef(null);
  const uploadQueueRef = useRef(Promise.resolve());
  const nextChunkIndexRef = useRef(0);

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function updateElapsedTime() {
    const runningMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    const nextElapsedSeconds = Math.floor((accumulatedMsRef.current + runningMs) / 1000);
    setElapsedSeconds(nextElapsedSeconds);
  }

  function startTimer() {
    clearTimer();
    uploadQueueRef.current = Promise.resolve();
    nextChunkIndexRef.current = 0;
    setSavedChunkCount(0);
    updateElapsedTime();
    timerRef.current = window.setInterval(updateElapsedTime, 250);
  }

  function pauseTimer() {
    if (startedAtRef.current) {
      accumulatedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    updateElapsedTime();
    clearTimer();
  }

  function resetRecorderState() {
    accumulatedMsRef.current = 0;
    mediaRecorderRef.current = null;
    sessionIdRef.current = null;
    startedAtRef.current = null;
    clearTimer();
    setElapsedSeconds(0);
    setSessionId(null);
    setState("idle");
  }

  async function startRecording({ recordingStream = null, saveMode = "full", title = null } = {}) {
    const activeStream = recordingStream ?? stream;
    if (!activeStream) {
      throw new Error("Recording stream not ready.");
    }

    if (!globalThis.MediaRecorder) {
      throw new Error("MediaRecorder not supported.");
    }

    setError(null);

    if (reviewBlobUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(reviewBlobUrlRef.current);
    }
    if (reviewBlobUrlRef.current) {
      reviewBlobUrlRef.current = null;
      setRecordedBlobUrl(null);
    }

    const session = await createSession({
      language,
      save_mode: saveMode,
      title,
    });

    const recorder = new MediaRecorder(activeStream, getRecorderOptions(videoQuality));

    resetRecorderState();
    sessionIdRef.current = session.session_id;
    setSessionId(session.session_id);
    setState("recording");

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) {
        return;
      }

      const chunkIndex = nextChunkIndexRef.current++;
      uploadQueueRef.current = uploadQueueRef.current
        .then(() => uploadSessionChunk(session.session_id, chunkIndex, event.data))
        .then(() => setSavedChunkCount((count) => count + 1));
    };

    const videoTrack = activeStream.getVideoTracks()[0] ?? null;
    if (videoTrack) {
      videoTrack.addEventListener(
        "ended",
        () => {
          if (recorder.state === "recording" || recorder.state === "paused") {
            recorder.stop();
          }
        },
        { once: true },
      );
    }

    recorder.onerror = (event) => {
      const nextError = event?.error ?? new Error("Recording failed.");
      setError(nextError);
      setState("error");
      clearTimer();
      if (stopRejecterRef.current) {
        stopRejecterRef.current(nextError);
      }
    };

    recorder.onstop = async () => {
      try {
        await uploadQueueRef.current;
        if (nextChunkIndexRef.current <= 0) {
          throw new Error("No recording data captured.");
        }
        await prepareSessionPreview(session.session_id);
        const blobUrl = getSessionVideoUrl(session.session_id);
        reviewBlobUrlRef.current = blobUrl;
        setRecordedBlobUrl(blobUrl);
        setState("stopped");
        if (stopResolverRef.current) {
          stopResolverRef.current({
            blob: null,
            blobUrl,
            elapsedSeconds: Math.floor(accumulatedMsRef.current / 1000),
            sessionId: session.session_id,
          });
        }
      } catch (caughtError) {
        setError(caughtError);
        setState("error");
        if (stopRejecterRef.current) {
          stopRejecterRef.current(caughtError);
        }
      } finally {
        stopPromiseRef.current = null;
        stopResolverRef.current = null;
        stopRejecterRef.current = null;
      }
    };

    mediaRecorderRef.current = recorder;
    startedAtRef.current = Date.now();
    startTimer();
    recorder.start(CHUNK_INTERVAL_MS);
    return session.session_id;
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }

    recorder.pause();
    pauseTimer();
    setState("paused");
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      return;
    }

    recorder.resume();
    startedAtRef.current = Date.now();
    startTimer();
    setState("recording");
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || (recorder.state !== "recording" && recorder.state !== "paused")) {
      return Promise.resolve(null);
    }

    if (stopPromiseRef.current) {
      return stopPromiseRef.current;
    }

    pauseTimer();
    setState("stopping");

    stopPromiseRef.current = new Promise((resolve, reject) => {
      stopResolverRef.current = resolve;
      stopRejecterRef.current = reject;
    });

    recorder.stop();
    return stopPromiseRef.current;
  }

  useEffect(() => {
    return () => {
      clearTimer();
      if (reviewBlobUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(reviewBlobUrlRef.current);
      }
    };
  }, []);

  return {
    elapsedSeconds,
    error,
    pauseRecording,
    recordedBlobUrl,
    resumeRecording,
    sessionId,
    savedChunkCount,
    startRecording,
    state,
    stopRecording,
  };
}
