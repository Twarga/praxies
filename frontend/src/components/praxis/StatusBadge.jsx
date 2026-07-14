import { cn } from "../../lib/cn.js";
import { getStatusLabel } from "../../lib/statusLabels.js";

const STYLE_BY_STATUS = {
  idle: "text-[var(--praxis-text-muted)] border-[var(--praxis-line-subtle)]",
  local: "text-[var(--praxis-text-muted)] border-[var(--praxis-line-subtle)]",
  ready: "text-[var(--praxis-success)] border-[var(--praxis-success)]/30 bg-[var(--praxis-success-soft)]",
  done: "text-[var(--praxis-success)] border-[var(--praxis-success)]/30 bg-[var(--praxis-success-soft)]",
  recording: "text-[var(--praxis-record)] border-[var(--praxis-record)]/40 bg-[var(--praxis-record)]/10",
  paused: "text-[var(--praxis-warning)] border-[var(--praxis-warning)]/30 bg-[var(--praxis-warning-soft)]",
  transcribing: "text-[var(--praxis-warning)] border-[var(--praxis-warning)]/30 bg-[var(--praxis-warning-soft)]",
  analyzing: "text-[var(--praxis-accent)] border-[var(--praxis-accent)]/30 bg-[var(--praxis-accent-muted)]",
  processing: "text-[var(--praxis-accent)] border-[var(--praxis-accent)]/30 bg-[var(--praxis-accent-muted)]",
  failed: "text-[var(--praxis-danger)] border-[var(--praxis-danger)]/30 bg-[var(--praxis-danger-soft)]",
  queued: "text-[var(--praxis-text-muted)] border-[var(--praxis-line-subtle)]",
  needs_attention: "text-[var(--praxis-warning)] border-[var(--praxis-warning)]/40 bg-[var(--praxis-warning-soft)]",
  video_only: "text-[var(--praxis-text-secondary)] border-[var(--praxis-line-subtle)]",
  offline: "text-[var(--praxis-text-muted)] border-[var(--praxis-line-subtle)]",
};

export function StatusBadge({ status, className, label: labelOverride }) {
  const key = String(status || "idle").toLowerCase();
  const style = STYLE_BY_STATUS[key] || STYLE_BY_STATUS.idle;
  const label = labelOverride || getStatusLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--praxis-radius-sm)] border px-2 py-0.5",
        "text-[11px] font-medium tracking-tight",
        style,
        className,
      )}
      data-status={key}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full bg-current",
          key === "recording" && "praxis-record-indicator",
          (key === "transcribing" || key === "analyzing" || key === "processing") && "animate-pulse",
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
