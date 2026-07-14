// Map backend statuses to the design's normalized status set + display labels.
// Backend statuses:
//   "recording" | "saved" | "queued" | "transcribing" | "analyzing"
// | "ready" | "done" | "failed" | "needs_attention" | "video_only"

import { getStatusLabel as getControlRoomStatusLabel } from "./statusLabels.js";

const PROCESSING_STATUSES = new Set(["queued", "transcribing", "analyzing"]);
const ATTENTION_STATUSES = new Set(["failed", "needs_attention"]);
const READY_STATUSES = new Set(["ready", "done"]);

export function isReadyStatus(status) {
  return READY_STATUSES.has(status);
}

export function isProcessingStatus(status) {
  return PROCESSING_STATUSES.has(status);
}

export function isAttentionStatus(status) {
  return ATTENTION_STATUSES.has(status);
}

export function getStatusBadgeStyle(status) {
  if (READY_STATUSES.has(status)) {
    return "bg-[var(--praxis-success-soft)] text-[var(--praxis-success)] border border-[var(--praxis-success)]/30";
  }
  if (status === "failed") {
    return "bg-[var(--praxis-danger-soft)] text-[var(--praxis-danger)] border border-[var(--praxis-danger)]/30";
  }
  if (status === "needs_attention") {
    return "bg-[var(--praxis-warning-soft)] text-[var(--praxis-warning)] border border-[var(--praxis-warning)]/30";
  }
  if (PROCESSING_STATUSES.has(status)) {
    return "bg-[var(--praxis-accent-muted)] text-[var(--praxis-accent)] border border-[var(--praxis-accent)]/30";
  }
  if (status === "saved" || status === "video_only" || status === "recording") {
    return "bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-secondary)] border border-[var(--praxis-line-subtle)]";
  }
  return "bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-secondary)] border border-[var(--praxis-line-subtle)]";
}

export function getStatusLabel(status) {
  return getControlRoomStatusLabel(status);
}

export function getProcessingLabel(status) {
  return getControlRoomStatusLabel(status);
}

export function formatDuration(durationSeconds) {
  const total = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function formatDurationMinutes(durationSeconds) {
  const total = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  const mins = Math.floor(total / 60);
  if (mins >= 1) return `${mins} min`;
  return `${total}s`;
}

export function formatShortDate(value) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "";
  }
}

export function formatLongDate(value) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function formatLanguageBadge(lang) {
  if (!lang) return "—";
  if (lang === "en") return "EN_US";
  if (lang === "fr") return "FR_FR";
  if (lang === "es") return "ES_ES";
  return String(lang).toUpperCase();
}

export function getSessionTitle(session) {
  return session?.title?.trim() || session?.id || "untitled session";
}
