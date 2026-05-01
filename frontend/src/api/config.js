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

export function loadOpenRouterModels() {
  return apiFetchJson("/api/openrouter/models");
}

export function testOpenRouter() {
  return apiFetchJson("/api/config/test-openrouter", {
    method: "POST",
  });
}

export function testWhisper() {
  return apiFetchJson("/api/config/test-whisper", {
    method: "POST",
  });
}
