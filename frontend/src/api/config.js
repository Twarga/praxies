import { apiFetchJson } from "./client.js";

export function loadConfig() {
  return apiFetchJson("/api/config");
}

export function patchConfig(patch) {
  return apiFetchJson("/api/config", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
