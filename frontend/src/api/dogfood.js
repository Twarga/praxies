import { apiFetchJson } from "./client.js";

export function saveDogfoodCheckin(payload) {
  return apiFetchJson("/api/dogfood/checkins", { method: "POST", body: payload });
}

export function getDogfoodWeeklySummary() {
  return apiFetchJson("/api/dogfood/weekly-summary");
}
