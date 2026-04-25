import { apiFetchJson, buildApiUrl } from "./client.js";

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

export function getSessionVideoUrl(sessionId) {
  return buildApiUrl(`/api/sessions/${sessionId}/video`);
}

export function markSessionRead(sessionId) {
  return apiFetchJson(`/api/sessions/${sessionId}/mark-read`, {
    method: "POST",
  });
}
