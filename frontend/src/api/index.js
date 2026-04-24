import { apiFetchJson } from "./client.js";

export function loadIndex() {
  return apiFetchJson("/api/index");
}
