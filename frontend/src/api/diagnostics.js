import { apiFetchJson } from "./client.js";

export function getDiagnosticsHealth() {
  return apiFetchJson("/api/diagnostics/health");
}

export function getDiagnosticsChecks() {
  return apiFetchJson("/api/diagnostics/checks");
}

export function retestDiagnostics() {
  return apiFetchJson("/api/diagnostics/retest", { method: "POST" });
}

export function getSupportBundle() {
  return apiFetchJson("/api/diagnostics/support-bundle");
}

export function repairIndex() {
  return apiFetchJson("/api/diagnostics/repair-index", { method: "POST" });
}

export function resetOnboarding() {
  return apiFetchJson("/api/diagnostics/reset-onboarding", { method: "POST" });
}
