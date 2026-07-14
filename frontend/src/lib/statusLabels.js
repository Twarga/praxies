/**
 * Control Room Studio — pipeline / shell status labels.
 * Color is never used alone; every status has a visible text label.
 */

export const STATUS_LABELS = {
  idle: "Local",
  local: "Local",
  ready: "Ready",
  done: "Ready",
  recording: "Recording",
  paused: "Paused",
  queued: "Queued",
  transcribing: "Transcribing",
  analyzing: "Analyzing",
  processing: "Processing",
  failed: "Failed",
  needs_attention: "Needs attention",
  video_only: "Video only",
  offline: "Offline",
};

/**
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function getStatusLabel(status) {
  if (!status) return STATUS_LABELS.idle;
  const key = String(status).toLowerCase().replace(/\s+/g, "_");
  return STATUS_LABELS[key] || String(status).replace(/_/g, " ");
}

/**
 * Shell-level status kinds used in the title bar / rail.
 * @typedef {"idle"|"active"|"ready"|"attention"|"recording"|"offline"} ShellStatusKind
 */

/**
 * @param {ShellStatusKind} kind
 * @returns {string}
 */
export function getShellStatusLabel(kind) {
  switch (kind) {
    case "active":
      return "Processing";
    case "ready":
      return "Ready";
    case "attention":
      return "Needs attention";
    case "recording":
      return "Recording";
    case "offline":
      return "Offline";
    case "idle":
    default:
      return "Local";
  }
}
