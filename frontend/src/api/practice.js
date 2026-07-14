import { apiFetchJson } from "./client.js";

export function getPracticeCurrent() {
  return apiFetchJson("/api/practice/current");
}

export function getPracticeHistory() {
  return apiFetchJson("/api/practice/history");
}

export function createPracticeGoal(payload) {
  return apiFetchJson("/api/practice/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completePracticeAssignment(assignmentId) {
  return apiFetchJson(`/api/practice/assignments/${encodeURIComponent(assignmentId)}`, {
    method: "PATCH",
  });
}
