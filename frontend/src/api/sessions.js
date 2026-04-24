import { apiFetchJson } from "./client.js";

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
