import { Filter, Mic, PanelRightOpen, Play, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionThumbnailUrl } from "../../api/sessions.js";
import { formatDuration, formatShortDate, getSessionTitle, getStatusBadgeStyle, getStatusLabel } from "../../lib/sessionUi.js";

function SessionStill({ sessionId }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="grid h-full place-items-center text-[var(--praxis-text-muted)]"><Play size={18} /></div>;
  return <img src={getSessionThumbnailUrl(sessionId)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}

export function SessionBrowser({
  sessions,
  groups,
  search,
  onSearch,
  langFilter,
  onLangFilter,
  statusFilter,
  onStatusFilter,
  dateRange,
  onDateRange,
  sort,
  onSort,
  onClearFilters,
  onNavigate,
  isLoading,
  hasArchiveSessions = false,
}) {
  const [selectedId, setSelectedId] = useState(() => window.localStorage.getItem("praxis.sessions.selected") || sessions[0]?.id || null);
  const [showFilters, setShowFilters] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [narrowDesktop, setNarrowDesktop] = useState(() => window.innerWidth < 1024);
  const [listWidth, setListWidth] = useState(() => {
    const storedWidth = Number(window.localStorage.getItem("praxis.sessions.split"));
    return storedWidth >= 260 && storedWidth <= 420 ? storedWidth : 300;
  });
  const browserRef = useRef(null);
  const searchRef = useRef(null);
  const selected = useMemo(() => sessions.find((session) => session.id === selectedId) || sessions[0] || null, [selectedId, sessions]);

  useEffect(() => {
    if (!sessions.some((session) => session.id === selectedId)) setSelectedId(sessions[0]?.id || null);
  }, [selectedId, sessions]);

  useEffect(() => {
    window.localStorage.setItem("praxis.sessions.split", String(listWidth));
  }, [listWidth]);

  useEffect(() => {
    if (selectedId) window.localStorage.setItem("praxis.sessions.selected", selectedId);
  }, [selectedId]);

  useEffect(() => {
    function updateViewport() { setNarrowDesktop(window.innerWidth < 1024); }
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    function focusSearch(event) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function handleListKeyDown(event) {
    const currentIndex = Math.max(0, sessions.findIndex((session) => session.id === selected?.id));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = sessions[Math.max(0, Math.min(sessions.length - 1, currentIndex + delta))];
      if (next) setSelectedId(next.id);
    }
    if (event.key === "Enter" && selected) {
      event.preventDefault();
      onNavigate("session", { sessionId: selected.id });
    }
  }

  function resizeFromPointer(clientX) {
    const bounds = browserRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setListWidth(Math.max(260, Math.min(420, clientX - bounds.left)));
  }

  function beginResize(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    function move(pointerEvent) { resizeFromPointer(pointerEvent.clientX); }
    function end() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--praxis-bg-canvas)]">
      <header className="praxis-toolbar shrink-0 justify-between gap-4 px-5" data-layout="master-detail">
        <div>
          <h1 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Sessions</h1>
          <p className="mt-0.5 text-[11px] text-[var(--praxis-text-muted)]">Local recording archive</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative hidden sm:block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--praxis-text-muted)]" />
            <input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search past sessions..." className="h-8 w-52 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] pl-8 pr-3 text-xs text-[var(--praxis-text-primary)] outline-none placeholder:text-[var(--praxis-text-muted)] focus:border-[var(--praxis-accent)]" />
          </label>
          <label className="relative">
            <SlidersHorizontal size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--praxis-text-muted)]" />
            <select value={langFilter} onChange={(event) => onLangFilter(event.target.value)} aria-label="Filter by language" className="h-8 appearance-none rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] py-1 pl-8 pr-6 text-xs text-[var(--praxis-text-secondary)] outline-none focus:border-[var(--praxis-accent)]">
              <option value="all">All languages</option>
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </label>
          <select value={sort} onChange={(event) => onSort(event.target.value)} aria-label="Sort sessions" className="hidden h-8 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2 text-xs text-[var(--praxis-text-secondary)] outline-none focus:border-[var(--praxis-accent)] md:block"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
          {narrowDesktop && selected ? <button type="button" onClick={() => setShowInspector(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2.5 text-xs text-[var(--praxis-text-secondary)]"><PanelRightOpen size={13} /> Preview</button> : null}
          <button type="button" onClick={() => setShowFilters((value) => !value)} className={"inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs " + (showFilters ? "border-[var(--praxis-accent)] bg-[var(--praxis-selected)] text-[var(--praxis-text-primary)]" : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-secondary)]")}>
            <Filter size={13} /> Filters
          </button>
        </div>
      </header>
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-5" aria-label="Session status filters">
        {[["all", "All"], ["ready", "Ready"], ["processing", "Processing"], ["failed", "Failed"]].map(([id, label]) => <button key={id} type="button" onClick={() => onStatusFilter(id)} aria-pressed={statusFilter === id} className={"rounded-[var(--praxis-radius-sm)] px-2.5 py-1 text-[11px] transition-[background-color,color,transform] duration-[var(--praxis-duration-quick)] active:scale-[0.97] " + (statusFilter === id ? "bg-[var(--praxis-selected)] text-[var(--praxis-text-primary)]" : "text-[var(--praxis-text-muted)] hover:bg-[var(--praxis-bg-hover)]")}>{label}</button>)}
      </div>
      {showFilters ? <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-5 py-2"><span className="mr-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--praxis-text-muted)]">Language</span>{[["all", "All"], ["en", "EN"], ["fr", "FR"], ["es", "ES"]].map(([id, label]) => <button key={id} type="button" onClick={() => onLangFilter(id)} className={"rounded-md px-2 py-1 text-[10px] font-mono " + (langFilter === id ? "bg-[var(--praxis-selected)] text-[var(--praxis-text-primary)]" : "text-[var(--praxis-text-muted)] hover:bg-[var(--praxis-bg-hover)]")}>{label}</button>)}<span className="ml-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--praxis-text-muted)]">Status</span><select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)} className="h-7 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2 text-[11px] text-[var(--praxis-text-secondary)]"><option value="all">All</option><option value="ready">Ready</option><option value="done">Done</option><option value="queued">Queued</option><option value="transcribing">Transcribing</option><option value="analyzing">Analysing</option><option value="needs_attention">Needs attention</option><option value="failed">Failed</option></select><span className="ml-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--praxis-text-muted)]">Date</span><select value={dateRange} onChange={(event) => onDateRange(event.target.value)} className="h-7 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2 text-[11px] text-[var(--praxis-text-secondary)]"><option value="all">Any time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></div> : null}

      {!isLoading && !sessions.length && !hasArchiveSessions ? (
        <div className="mx-auto flex min-h-0 flex-1 max-w-lg flex-col items-center justify-center px-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] text-[var(--praxis-accent)]"><Mic size={18} /></div>
          <h2 className="mt-4 text-base font-semibold text-[var(--praxis-text-primary)]">Your journal is empty</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--praxis-text-secondary)]">Record a baseline session. Its video, transcript, report, and practice goal will appear here.</p>
          <button type="button" onClick={() => onNavigate("record")} className="mt-5 h-8 rounded-md bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]">Record first session</button>
        </div>
      ) : (
      <div ref={browserRef} className="relative flex min-h-0 flex-1">
        <section tabIndex={0} onKeyDown={handleListKeyDown} aria-label="Session list" style={{ flex: narrowDesktop ? "1 1 0%" : `0 0 ${listWidth}px` }} className="min-w-[280px] overflow-y-auto bg-[var(--praxis-bg-panel)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--praxis-focus)]">
          {isLoading && !sessions.length ? <div className="px-4 py-6 text-sm text-[var(--praxis-text-muted)]">Loading sessions…</div> : null}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 border-y border-[var(--praxis-line-subtle)] bg-[var(--praxis-glass-reading)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--praxis-text-muted)] backdrop-blur-md">{group.label}</div>
              {group.sessions.map((session) => {
                const active = session.id === selected?.id;
                return (
                    <button key={session.id} type="button" onClick={() => { setSelectedId(session.id); if (narrowDesktop) setShowInspector(true); }} className={"flex w-full items-center gap-3 border-b border-l-2 border-b-[var(--praxis-line-subtle)] px-4 py-3 text-left transition-colors " + (active ? "border-l-[var(--praxis-accent)] bg-[var(--praxis-selected)]" : "border-l-transparent hover:bg-[var(--praxis-bg-hover)]")}>
                    <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--praxis-bg-elevated)]"><SessionStill sessionId={session.id} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--praxis-text-primary)]">{getSessionTitle(session)}</div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[var(--praxis-text-muted)]"><span>{formatShortDate(session.created_at)}</span><span>{formatDuration(session.duration_seconds)}</span></div>
                    </div>
                    {!session.read ? <span aria-label="Unread report" className="h-1.5 w-1.5 rounded-full bg-[var(--praxis-accent)]" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </section>

        {!narrowDesktop ? <div
          role="separator"
          aria-label="Resize session browser panes"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={beginResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") { event.preventDefault(); setListWidth((value) => Math.max(260, value - 8)); }
            if (event.key === "ArrowRight") { event.preventDefault(); setListWidth((value) => Math.min(420, value + 8)); }
          }}
          className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-[var(--praxis-line-subtle)] outline-none hover:bg-[var(--praxis-accent)] focus:bg-[var(--praxis-accent)]"
        ><span className="absolute left-1/2 top-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--praxis-bg-elevated)] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" /></div> : null}
        <section className={(narrowDesktop ? "absolute inset-y-0 right-0 z-20 w-[min(520px,86%)] border-l border-[var(--praxis-line-strong)] shadow-[var(--praxis-shadow-inspector)] " + (showInspector ? "block" : "hidden") : "min-w-0 flex-1") + " overflow-y-auto bg-[var(--praxis-bg-canvas)] p-6"}>
          {narrowDesktop ? <button type="button" onClick={() => setShowInspector(false)} className="mb-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2.5 text-xs text-[var(--praxis-text-secondary)]"><X size={13} /> Close preview</button> : null}
          {selected ? (
            <div className="mx-auto max-w-3xl">
              <div className="aspect-video overflow-hidden rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)]"><SessionStill sessionId={selected.id} /></div>
              <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--praxis-text-primary)]">Selected session</h2>
                  <p className="mt-1 text-sm text-[var(--praxis-text-secondary)]">{formatShortDate(selected.created_at)} · {formatDuration(selected.duration_seconds)} · {selected.language?.toUpperCase() || "—"}</p>
                </div>
                <span className={"rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-[0.08em] " + getStatusBadgeStyle(selected.status)}>{getStatusLabel(selected.status)}</span>
              </div>
              <div className="mt-6 border-y border-[var(--praxis-line-subtle)] py-4">
                <div className="text-[11px] font-medium text-[var(--praxis-text-muted)]">Report status</div>
                <p className="mt-2 max-w-[60ch] text-sm leading-6 text-[var(--praxis-text-secondary)]">{selected.read ? "This report has been reviewed. Open it to revisit its evidence and current practice goal." : "A new report is ready to review. Open it to get the next focused practice action."}</p>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => onNavigate("session", { sessionId: selected.id })} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]"><Play size={14} /> Open report</button>
                <button type="button" onClick={() => onNavigate("record")} className="h-8 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 text-xs text-[var(--praxis-text-secondary)]">Record again</button>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex min-h-[360px] max-w-md flex-col items-center justify-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] text-[var(--praxis-accent)]"><Mic size={18} /></div>
              <h2 className="mt-4 text-base font-semibold text-[var(--praxis-text-primary)]">No sessions match</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--praxis-text-secondary)]">No sessions match these filters.</p>
              <div className="mt-5 flex gap-2"><button type="button" onClick={onClearFilters} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 text-xs text-[var(--praxis-text-secondary)]"><X size={13} /> Clear filters</button><button type="button" onClick={() => onNavigate("record")} className="h-8 rounded-md bg-[var(--praxis-accent)] px-3 text-xs font-semibold text-[var(--praxis-on-accent)]">Record session</button></div>
            </div>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
