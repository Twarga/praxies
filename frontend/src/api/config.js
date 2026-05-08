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
  return apiFetchJson(`/api/openrouter/models?ts=${Date.now()}`, {
    cache: "no-store",
  });
}

export function loadLlmProviders() {
  return apiFetchJson(`/api/llm/providers?ts=${Date.now()}`, {
    cache: "no-store",
  });
}

export function loadSetupStatus() {
  return apiFetchJson(`/api/setup/status?ts=${Date.now()}`, {
    cache: "no-store",
  });
}

export function validateJournalFolder(journalFolder) {
  return apiFetchJson("/api/setup/validate-journal", {
    method: "POST",
    body: JSON.stringify({ journal_folder: journalFolder }),
  });
}

export function activateJournalFolder(journalFolder) {
  return apiFetchJson("/api/setup/activate-journal", {
    method: "POST",
    body: JSON.stringify({ journal_folder: journalFolder }),
  });
}

export function testOpenRouter() {
  return apiFetchJson("/api/config/test-openrouter", {
    method: "POST",
  });
}

export function testLlm() {
  return apiFetchJson("/api/config/test-llm", {
    method: "POST",
  });
}

export function testWhisper() {
  return apiFetchJson("/api/config/test-whisper", {
    method: "POST",
  });
}
