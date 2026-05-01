// Map backend statuses to the design's normalized status set + display labels.
// Backend statuses:
//   "recording" | "saved" | "queued" | "transcribing" | "analyzing"
// | "ready" | "done" | "failed" | "needs_attention" | "video_only"

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
    return "bg-[#1C3E2F] text-[#4ADE80]";
  }
  if (status === "failed") {
    return "bg-red-950/50 text-red-400 border border-red-900";
  }
  if (status === "needs_attention") {
    return "bg-yellow-950/40 text-yellow-300 border border-yellow-900";
  }
  if (PROCESSING_STATUSES.has(status)) {
    return "bg-[#2A2C31] text-[#D1D1D1]";
  }
  if (status === "saved" || status === "video_only" || status === "recording") {
    return "bg-[#2A2C31] text-[#D1D1D1]";
  }
  return "bg-[#2A2C31] text-[#D1D1D1]";
}

export function getStatusLabel(status) {
  if (status === "ready" || status === "done") return "ready";
  if (status === "needs_attention") return "needs attention";
  if (status === "video_only") return "video only";
  return status;
}

export function formatDuration(durationSeconds) {
  const total = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
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
  return session?.title?.trim() || "untitled session";
}

export function getProcessingLabel(status) {
  if (status === "queued") return "queued";
  if (status === "transcribing") return "transcribing";
  if (status === "analyzing") return "analyzing";
  return status;
}
