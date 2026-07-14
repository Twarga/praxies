export function ThemePicker({ themes, theme, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Application theme">
      {themes.map((item) => <button key={item.id} type="button" onClick={() => onChange(item.id)} aria-pressed={theme === item.id} className={"rounded-[var(--praxis-radius-md)] border p-4 text-left transition-[background-color,color,border-color,transform,box-shadow] duration-[var(--praxis-duration-control)] ease-[var(--praxis-ease-out)] active:scale-[0.97] " + (theme === item.id ? "border-[var(--praxis-accent)] bg-[var(--praxis-accent-soft)]" : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] hover:border-[var(--praxis-line-strong)]")}><div className="text-sm font-medium text-[var(--praxis-text-primary)]">{item.name}</div><div className="mt-1 text-xs leading-relaxed text-[var(--praxis-text-muted)]">{item.description}</div></button>)}
    </div>
  );
}
