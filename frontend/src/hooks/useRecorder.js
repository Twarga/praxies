import { useEffect, useRef, useState } from "react";
import { createSession, uploadSessionChunk } from "../api/sessions.js";

const PRIMARY_MIME_TYPE = "video/webm;codecs=vp8,opus";
const FALLBACK_MIME_TYPE = "video/webm";
const VIDEO_BITRATE = 2_500_000;
const CHUNK_TIMESLICE_MS = 10_000;

export function getRecorderOptions(MediaRecorderClass = globalThis.MediaRecorder) {
  if (MediaRecorderClass?.isTypeSupported?.(PRIMARY_MIME_TYPE)) {
    return {
      mimeType: PRIMARY_MIME_TYPE,
      videoBitsPerSecond: VIDEO_BITRATE,
    };
  }

  return {
    mimeType: FALLBACK_MIME_TYPE,
    videoBitsPerSecond: VIDEO_BITRATE,
  };
}

export function useRecorder({ language, stream }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState("idle");

  const accumulatedMsRef = useRef(0);
  const blobChunksRef = useRef([]);
  const chunkIndexRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const reviewBlobUrlRef = useRef(null);
  const sessionIdRef = useRef(null);
  const startedAtRef = useRef(null);
  const stopPromiseRef = useRef(null);
  const stopResolverRef = useRef(null);
  const stopRejecterRef = useRef(null);
  const timerRef = useRef(null);
  const uploadPromisesRef = useRef([]);

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
    blobChunksRef.current = [];
    chunkIndexRef.current = 0;
    mediaRecorderRef.current = null;
    sessionIdRef.current = null;
    startedAtRef.current = null;
    uploadPromisesRef.current = [];
    clearTimer();
    setElapsedSeconds(0);
    setSessionId(null);
    setRecordedBlob(null);
    setState("idle");
  }

  async function startRecording({ saveMode = "full", title = null } = {}) {
    if (!stream) {
      throw new Error("Recording stream not ready.");
    }

    if (!globalThis.MediaRecorder) {
      throw new Error("MediaRecorder not supported.");
    }

    setError(null);

    if (reviewBlobUrlRef.current) {
      URL.revokeObjectURL(reviewBlobUrlRef.current);
      reviewBlobUrlRef.current = null;
      setRecordedBlobUrl(null);
    }

    const session = await createSession({
      language,
      save_mode: saveMode,
      title,
    });

    const recorder = new MediaRecorder(stream, getRecorderOptions());
    const pendingUploads = [];

    resetRecorderState();
    sessionIdRef.current = session.session_id;
    setSessionId(session.session_id);
    setState("recording");

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) {
        return;
      }

      blobChunksRef.current.push(event.data);
      const chunkIndex = chunkIndexRef.current;
      chunkIndexRef.current += 1;

      const uploadPromise = uploadSessionChunk(session.session_id, chunkIndex, event.data);
      pendingUploads.push(uploadPromise);
      uploadPromisesRef.current = pendingUploads;
    };

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
        await Promise.all(uploadPromisesRef.current);
        const blob = new Blob(blobChunksRef.current, { type: recorder.mimeType || FALLBACK_MIME_TYPE });
        const blobUrl = URL.createObjectURL(blob);
        reviewBlobUrlRef.current = blobUrl;
        setRecordedBlob(blob);
        setRecordedBlobUrl(blobUrl);
        setState("stopped");
        if (stopResolverRef.current) {
          stopResolverRef.current({
            blob,
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
    recorder.start(CHUNK_TIMESLICE_MS);
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
      if (reviewBlobUrlRef.current) {
        URL.revokeObjectURL(reviewBlobUrlRef.current);
      }
    };
  }, []);

  return {
    elapsedSeconds,
    error,
    pauseRecording,
    recordedBlob,
    recordedBlobUrl,
    resumeRecording,
    sessionId,
    startRecording,
    state,
    stopRecording,
  };
}
