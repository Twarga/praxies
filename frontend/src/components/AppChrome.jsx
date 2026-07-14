import { useEffect, useMemo, useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/Command.jsx";
import { Dialog, DialogContent, DialogTitle } from "./ui/Dialog.jsx";
import {
  BookOpenCheck,
  FileVideo2,
  Gauge,
  Mic,
  Minus,
  Search,
  Settings2,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useIndex } from "../hooks/useIndex.js";
import { useEventSource } from "../hooks/useEventSource.js";
import { getPageLabel } from "../lib/nav.js";
import { getShellStatusLabel } from "../lib/statusLabels.js";
import { getLiveBadgeState } from "./Sidebar.jsx";
import { StatusBadge } from "./praxis/StatusBadge.jsx";
import { PraxisLogo } from "./praxis/PraxisLogo.jsx";
import { cn } from "../lib/cn.js";
import { closeDesktopWindow, minimizeDesktopWindow, toggleMaximizeDesktopWindow } from "../lib/desktop.js";

const ACTIONS = [
  { id: "record", label: "Record journal", hint: "Ctrl 2", icon: Mic, keywords: "new video journal recording" },
  { id: "today", label: "Open current goal", hint: "Ctrl 1", icon: Sparkles, keywords: "today goal next practice" },
  { id: "practice", label: "Practice this goal", hint: "Ctrl 3", icon: BookOpenCheck, keywords: "exercise drill assignment" },
  { id: "gallery", label: "Browse sessions", hint: "Ctrl 4", icon: FileVideo2, keywords: "sessions archive video reports gallery" },
  { id: "trends", label: "Open progress", hint: "Ctrl 5", icon: Gauge, keywords: "progress trend evidence improvement stats" },
  { id: "settings", label: "Open settings", hint: "Ctrl ,", icon: Settings2, keywords: "provider transcription storage configuration" },
  { id: "goals", label: "Goals", hint: "Coming soon", icon: Sparkles, keywords: "goals objective target", disabled: true },
  { id: "flashcards", label: "Flashcards", hint: "Coming soon", icon: BookOpenCheck, keywords: "flashcards recall review", disabled: true },
  { id: "learning-paths", label: "Learning paths", hint: "Coming soon", icon: Gauge, keywords: "learning path roadmap practice", disabled: true },
];

export function CommandPalette({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const { index } = useIndex();
  const latestSession = index?.sessions?.find((session) => ["ready", "done"].includes(session.status));
  const recentSessions = index?.sessions?.slice(0, 8) || [];

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.altKey) {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function run(action) {
    if (action.disabled) return;
    setOpen(false);
    onNavigate(action.id, action.params);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-2 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2.5 text-xs text-[var(--praxis-text-secondary)] transition-colors hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)]"
        aria-label="Open command palette"
      >
        <Search size={14} />
        <span className="hidden lg:inline">Search commands</span>
        <kbd className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-video-surface)]/15 px-1.5 py-0.5 font-mono text-[10px] text-[var(--praxis-text-muted)]">
          ⌘K
        </kbd>
      </button>
      <DialogContent motion="none" className="praxis-glass-overlay w-[min(620px,calc(100vw-32px))] overflow-hidden rounded-[var(--praxis-radius-modal)] p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command shouldFilter label="Praxis command palette">
          <CommandInput placeholder="Search commands, sessions, settings…" autoFocus />
          <CommandList className="max-h-[min(60vh,420px)] p-2">
            <CommandEmpty className="px-3 py-8 text-center text-sm text-[var(--praxis-text-muted)]">
              No command found.
            </CommandEmpty>
            <div className="px-2 pb-1 pt-2 text-[10px] font-medium tracking-wide text-[var(--praxis-text-muted)]">
              Go to
            </div>
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  value={action.label + " " + action.keywords}
                  onSelect={() => run(action)}
                  disabled={action.disabled}
                  className="flex items-center gap-3 rounded-[var(--praxis-radius-sm)] px-3 py-2 text-sm aria-selected:bg-[var(--praxis-selected)] data-[disabled=true]:opacity-50"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-accent)]">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">{action.label}</span>
                  <kbd className="font-mono text-[10px] text-[var(--praxis-text-muted)]">{action.hint}</kbd>
                </CommandItem>
              );
            })}
            {latestSession ? (
              <>
                <div className="px-2 pb-1 pt-4 text-[10px] font-medium tracking-wide text-[var(--praxis-text-muted)]">
                  Recent local files
                </div>
                <CommandItem
                  value="open latest report local session"
                  onSelect={() => run({ id: "session", params: { sessionId: latestSession.id } })}
                  className="flex items-center gap-3 rounded-[var(--praxis-radius-sm)] px-3 py-2 text-sm aria-selected:bg-[var(--praxis-selected)]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-accent)]">
                    <FileVideo2 size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">Open latest report</span>
                  <span className="font-mono text-[10px] text-[var(--praxis-text-muted)]">Local</span>
                </CommandItem>
              </>
            ) : null}
            {recentSessions.length ? (
              <>
                <div className="px-2 pb-1 pt-4 text-[10px] font-medium tracking-wide text-[var(--praxis-text-muted)]">
                  Sessions
                </div>
                {recentSessions.map((session) => (
                  <CommandItem
                    key={session.id}
                    value={`session ${session.title || session.id} ${session.language || ""} ${session.status || ""}`}
                    onSelect={() => run({ id: "session", params: { sessionId: session.id } })}
                    className="flex items-center gap-3 rounded-[var(--praxis-radius-sm)] px-3 py-2 text-sm aria-selected:bg-[var(--praxis-selected)]"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-accent)]">
                      <FileVideo2 size={15} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{session.title || session.id}</span>
                    <span className="font-mono text-[10px] text-[var(--praxis-text-muted)]">
                      {session.language?.toUpperCase() || "Local"}
                    </span>
                  </CommandItem>
                ))}
              </>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function shellStatusToBadgeStatus(kind) {
  if (kind === "attention") return "needs_attention";
  if (kind === "active") return "processing";
  if (kind === "ready") return "ready";
  if (kind === "recording") return "recording";
  if (kind === "offline") return "offline";
  return "local";
}

export function AppChrome({ currentPage, onNavigate, isRecordingRoute = false }) {
  const context = useMemo(() => getPageLabel(currentPage), [currentPage]);
  const isRecording = isRecordingRoute && currentPage === "record";
  const { index } = useIndex();
  const { lastEvent } = useEventSource();
  const live = getLiveBadgeState(index, lastEvent);
  const shellKind = isRecording ? "recording" : live.kind;
  const shellLabel = isRecording ? getShellStatusLabel("recording") : live.label;

  return (
    <header className="praxis-titlebar praxis-glass-chrome flex shrink-0 items-center justify-between gap-3 px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <PraxisLogo size={24} />
        <span className="text-sm font-semibold tracking-tight text-[var(--praxis-text-primary)]">Praxis</span>
      </div>

      <div className="min-w-0 flex-1 text-center text-xs text-[var(--praxis-text-secondary)]">
        <span className="hidden sm:inline">Praxis / </span>
        <span className="font-medium text-[var(--praxis-text-primary)]">
          {isRecording ? "Recording" : context}
        </span>
      </div>

      <div className="praxis-no-drag flex items-center gap-2">
        <StatusBadge
          status={shellStatusToBadgeStatus(shellKind)}
          label={shellLabel}
          className={cn("hidden sm:inline-flex", isRecording && "sm:inline-flex")}
        />
        {isRecording ? (
          <button
            type="button"
            onClick={() => onNavigate("today")}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2.5 text-xs text-[var(--praxis-text-secondary)] hover:text-[var(--praxis-text-primary)]"
          >
            <X size={14} /> Exit
          </button>
        ) : (
          <CommandPalette onNavigate={onNavigate} />
        )}
        <div className="ml-1 hidden items-center border-l border-[var(--praxis-line-subtle)] pl-1 lg:flex" aria-label="Window controls">
          <button type="button" onClick={() => void minimizeDesktopWindow()} aria-label="Minimize window" className="grid h-8 w-8 place-items-center rounded text-[var(--praxis-text-muted)] transition-[background-color,color,transform] duration-[var(--praxis-duration-quick)] ease-[var(--praxis-ease-out)] hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)] active:scale-[0.97]"><Minus size={14} /></button>
          <button type="button" onClick={() => void toggleMaximizeDesktopWindow()} aria-label="Maximize window" className="grid h-8 w-8 place-items-center rounded text-[var(--praxis-text-muted)] transition-[background-color,color,transform] duration-[var(--praxis-duration-quick)] ease-[var(--praxis-ease-out)] hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)] active:scale-[0.97]"><Square size={12} /></button>
          <button type="button" onClick={() => void closeDesktopWindow()} aria-label="Close window" className="grid h-8 w-8 place-items-center rounded text-[var(--praxis-text-muted)] transition-[background-color,color,transform] duration-[var(--praxis-duration-quick)] ease-[var(--praxis-ease-out)] hover:bg-[var(--praxis-danger-soft)] hover:text-[var(--praxis-danger)] active:scale-[0.97]"><X size={14} /></button>
        </div>
      </div>
    </header>
  );
}
