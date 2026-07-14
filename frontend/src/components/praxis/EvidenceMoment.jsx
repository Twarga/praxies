export function EvidenceMoment({ timestamp, quote, explanation, onSeek, active = false }) {
  const ts = Number(timestamp) || 0;
  const mins = Math.floor(ts / 60);
  const secs = Math.floor(ts % 60);
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <button
      type="button"
      role="button"
      onClick={() => onSeek?.(ts)}
      aria-current={active ? "true" : undefined}
      className={`w-full rounded-[var(--praxis-radius-md)] border p-4 text-left transition-[border-color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus-ring)] ${active ? "translate-x-1 border-[var(--praxis-accent)] bg-[var(--praxis-selected)]" : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] hover:border-[var(--praxis-accent)]/50 hover:bg-[var(--praxis-bg-panel-raised)]"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-[var(--praxis-accent)] tracking-[var(--praxis-tracking-label)]">
          {formatted}
        </span>
        {active ? <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-accent)]">Playing</span> : null}
      </div>
      {quote ? (
        <blockquote className="text-[var(--praxis-text-primary)] text-sm italic leading-[var(--praxis-leading-relaxed)] border-l-2 border-[var(--praxis-line-subtle)] pl-3">
          "{quote}"
        </blockquote>
      ) : null}
      {explanation ? (
        <p className="mt-2 text-[var(--praxis-text-secondary)] text-[12px] leading-[var(--praxis-leading-relaxed)]">
          {explanation}
        </p>
      ) : null}
    </button>
  );
}
