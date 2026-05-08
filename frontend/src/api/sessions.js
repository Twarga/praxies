import { apiFetchJson, apiFetchText, buildApiUrl } from "./client.js";

export function createSession(payload) {
  return apiFetchJson("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadSessionChunk(sessionId, chunkIndex, blob) {
  const formData = new FormData();
  formData.append("file", blob, `chunk-${chunkIndex}.webm`);

  return apiFetchJson(`/api/sessions/${sessionId}/chunk`, {
    method: "POST",
    headers: {
      "X-Chunk-Index": String(chunkIndex),
    },
    body: formData,
  });
}

export function finalizeSession(sessionId, payload) {
  return apiFetchJson(`/api/sessions/${sessionId}/finalize`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteSession(sessionId) {
  return apiFetchJson(`/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function loadSession(sessionId) {
  return apiFetchJson(`/api/sessions/${sessionId}`);
}

export function loadTodayDigest() {
  return apiFetchJson("/api/digest/today");
}

export function getSessionVideoUrl(sessionId) {
  return buildApiUrl(`/api/sessions/${sessionId}/video`);
}

export function getSessionSubtitleUrl(sessionId, language, format = "vtt") {
  return buildApiUrl(`/api/sessions/${sessionId}/subtitles/${language}.${format}`);
}

export function getSessionExportedVideoUrl(sessionId, filename) {
  return buildApiUrl(`/api/sessions/${sessionId}/exports/${filename}`);
}

export function getSessionThumbnailUrl(sessionId) {
  return buildApiUrl(`/api/sessions/${sessionId}/thumbnail`);
}

export function markSessionRead(sessionId) {
  return apiFetchJson(`/api/sessions/${sessionId}/mark-read`, {
    method: "POST",
  });
}

export function updateSessionPractice(sessionId, payload) {
  return apiFetchJson(`/api/sessions/${sessionId}/practice`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function retrySessionProcessing(sessionId) {
  return apiFetchJson(`/api/sessions/${sessionId}/retry`, {
    method: "POST",
  });
}

export function reanalyzeSession(sessionId, payload = {}) {
  return apiFetchJson(`/api/sessions/${sessionId}/reanalyze`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function exportSessionPrompt(sessionId) {
  return apiFetchText(`/api/sessions/${sessionId}/export-prompt`);
}

export function exportSessionTranscript(sessionId) {
  return apiFetchText(`/api/sessions/${sessionId}/export-transcript`);
}

export function exportSessionSubtitledVideo(sessionId, targetLanguage) {
  const normalizedTargetLanguage = String(targetLanguage ?? "").trim().toLowerCase();

  return apiFetchJson(`/api/sessions/${sessionId}/export-subtitled-video`, {
    method: "POST",
    body: JSON.stringify({ target_language: normalizedTargetLanguage }),
  });
}

export function importSessionAnalysis(sessionId, responseText) {
  return apiFetchJson(`/api/sessions/${sessionId}/import-analysis`, {
    method: "POST",
    body: JSON.stringify({ response_text: responseText }),
  });
}
