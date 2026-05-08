import { apiFetchJson } from "./client.js";

export function loadTrends(range = "30d") {
  return apiFetchJson(`/api/trends?range=${encodeURIComponent(range)}`);
}

export function loadPatterns(language) {
  return apiFetchJson(`/api/patterns/${encodeURIComponent(language)}`);
}

export function calibratePattern(language, payload) {
  return apiFetchJson(`/api/patterns/${encodeURIComponent(language)}/calibrate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
