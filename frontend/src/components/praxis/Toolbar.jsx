export function Toolbar({ title, status, children }) {
  return (
    <header className="h-12 border-b border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] flex items-center px-6 shrink-0 justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-[var(--praxis-text-primary)] text-sm font-semibold tracking-[var(--praxis-tracking-wide)]">
          {title}
        </h2>
        {status ? (
          <span className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-text-muted)]">
            {status}
          </span>
        ) : null}
      </div>
      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}
