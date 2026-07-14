import { apiFetchJson } from "./client.js";

export function getTranscriptionRuntime() {
  return apiFetchJson("/api/transcription/runtime");
}

export function getTranscriptionEngines() {
  return apiFetchJson("/api/transcription/engines");
}

export function getTranscriptionModels(engineId = "faster_whisper") {
  return apiFetchJson(`/api/transcription/models?engine_id=${encodeURIComponent(engineId)}`);
}

export function verifyModel(modelId, engineId = "faster_whisper") {
  return apiFetchJson(`/api/transcription/models/${encodeURIComponent(modelId)}/verify?engine_id=${encodeURIComponent(engineId)}`, {
    method: "POST",
  });
}

export function benchmarkModel(modelId, engineId = "faster_whisper") {
  return apiFetchJson(`/api/transcription/models/${encodeURIComponent(modelId)}/benchmark?engine_id=${encodeURIComponent(engineId)}`, {
    method: "POST",
  });
}

export function getHardwareInfo() {
  return apiFetchJson("/api/transcription/hardware");
}

export function downloadTranscriptionModel(modelId, engineId = "faster_whisper") {
  return apiFetchJson(`/api/transcription/models/${encodeURIComponent(modelId)}/download?engine_id=${encodeURIComponent(engineId)}`, { method: "POST" });
}

export function getTranscriptionDownload(downloadId) {
  return apiFetchJson(`/api/transcription/downloads/${encodeURIComponent(downloadId)}`);
}

export function pauseTranscriptionDownload(downloadId) {
  return apiFetchJson(`/api/transcription/downloads/${encodeURIComponent(downloadId)}/pause`, { method: "POST" });
}

export function resumeTranscriptionDownload(downloadId) {
  return apiFetchJson(`/api/transcription/downloads/${encodeURIComponent(downloadId)}/resume`, { method: "POST" });
}

export function cancelTranscriptionDownload(downloadId) {
  return apiFetchJson(`/api/transcription/downloads/${encodeURIComponent(downloadId)}`, { method: "DELETE" });
}

export function activateTranscriptionModel(modelId) {
  return apiFetchJson("/api/transcription/active", { method: "PATCH", body: { model_id: modelId } });
}

export function removeTranscriptionModel(modelId) {
  return apiFetchJson(`/api/transcription/models/${encodeURIComponent(modelId)}`, { method: "DELETE" });
}

export function getTranscriptionComparisonSessions() {
  return apiFetchJson("/api/transcription/comparison-sessions");
}

export function compareTranscriptionModel(modelId, sessionId, engineId = "faster_whisper") {
  return apiFetchJson(`/api/transcription/models/${encodeURIComponent(modelId)}/compare/${encodeURIComponent(sessionId)}?engine_id=${encodeURIComponent(engineId)}`, { method: "POST" });
}
