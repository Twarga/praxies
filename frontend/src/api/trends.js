import { apiFetchJson } from "./client.js";

export function loadTrends(range = "30d") {
  return apiFetchJson(`/api/trends?range=${encodeURIComponent(range)}`);
}
