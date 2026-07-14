import {
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  Dumbbell,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  TrendingUp,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useEventSource } from "../hooks/useEventSource.js";
import { useIndex } from "../hooks/useIndex.js";
import { PRIMARY_NAV } from "../lib/nav.js";
import { getShellStatusLabel, getStatusLabel } from "../lib/statusLabels.js";
import { cn } from "../lib/cn.js";

const NAV_ICONS = {
  today: LayoutDashboard,
  record: Mic,
  practice: Dumbbell,
  gallery: Video,
  trends: TrendingUp,
};

const ACTIVE_STATUSES = new Set(["queued", "transcribing", "analyzing"]);
const READY_STATUSES = new Set(["ready", "done"]);
const ATTENTION_STATUSES = new Set(["needs_attention", "failed"]);

function getSessionTitle(session) {
  return session?.title?.trim() || session?.id || "Untitled";
}

export function getLiveBadgeState(index, lastEvent) {
  const sessions = index?.sessions ?? [];
  const activeSessions = sessions.filter((session) => ACTIVE_STATUSES.has(session.status));
  const attentionSessions = sessions.filter((session) => ATTENTION_STATUSES.has(session.status));

  if (attentionSessions.length > 0) {
    const attentionSession = attentionSessions[0];
    return {
      kind: "attention",
      session: attentionSession,
      count: attentionSessions.length,
      label: getShellStatusLabel("attention"),
      detail: getSessionTitle(attentionSession),
    };
  }

  if (activeSessions.length > 0) {
    const activeSession = activeSessions[0];
    return {
      kind: "active",
      session: activeSession,
      count: activeSessions.length,
      label: getStatusLabel(activeSession.status) || getShellStatusLabel("active"),
      detail: getSessionTitle(activeSession),
    };
  }

  const readyEventSessionId =
    lastEvent?.type === "session.ready" ? lastEvent.data?.session_id : null;
  const eventReadySession = readyEventSessionId
    ? sessions.find((session) => session.id === readyEventSessionId)
    : null;
  const unreadReadySessions = sessions.filter(
    (session) => READY_STATUSES.has(session.status) && !session.read,
  );
  const readySession = eventReadySession || unreadReadySessions[0];

  if (readySession && READY_STATUSES.has(readySession.status)) {
    return {
      kind: "ready",
      session: readySession,
      count: unreadReadySessions.length,
      label: getShellStatusLabel("ready"),
      detail: getSessionTitle(readySession),
    };
  }

  return {
    kind: "idle",
    session: null,
    count: 0,
    label: getShellStatusLabel("idle"),
    detail: "No active tasks",
  };
}

function ProcessingBadge({ state, eventStatus, onNavigate, collapsed }) {
  const isActionable = Boolean(state.session);
  const Icon =
    state.kind === "attention" ? AlertCircle : state.kind === "ready" ? CheckCircle2 : Loader2;
  const iconClass =
    state.kind === "attention"
      ? "text-[var(--praxis-danger)]"
      : state.kind === "ready"
        ? "text-[var(--praxis-success)]"
        : state.kind === "active"
          ? "text-[var(--praxis-accent)] animate-spin"
          : "text-[var(--praxis-text-muted)]";
  const borderClass =
    state.kind === "attention"
      ? "border-[var(--praxis-danger)]/35 bg-[var(--praxis-danger-soft)]"
      : state.kind === "ready"
        ? "border-[var(--praxis-success)]/35 bg-[var(--praxis-success-soft)]"
        : state.kind === "active"
          ? "border-[var(--praxis-accent)]/35 bg-[var(--praxis-accent-muted)]"
          : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)]";
  const connectionLabel = eventStatus === "connected" ? "Live" : getStatusLabel(eventStatus || "offline");

  const content = (
    <>
      <Icon size={15} className={cn("shrink-0", iconClass)} aria-hidden="true" />
      <div className={collapsed ? "hidden" : "hidden min-w-0 flex-1 sm:block"}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[var(--praxis-text-muted)]">{connectionLabel}</span>
          {state.count > 1 ? (
            <span className="font-mono text-[10px] text-[var(--praxis-text-secondary)] tnum">
              {state.count}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate text-[12px] font-medium text-[var(--praxis-text-primary)]">
          {state.label}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[var(--praxis-text-muted)]">{state.detail}</div>
      </div>
    </>
  );

  const shellClass = cn(
    "flex min-h-10 w-10 items-center justify-center gap-2 rounded-[var(--praxis-radius-sm)] border p-2 transition-colors",
    borderClass,
    collapsed ? "sm:w-10" : "sm:w-full sm:min-h-[56px] sm:justify-start sm:px-3",
  );

  if (!isActionable) {
    return (
      <div className={shellClass} title={`${state.label}: ${state.detail}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate("session", { sessionId: state.session.id })}
      className={cn(shellClass, "text-left hover:border-[var(--praxis-text-primary)]/20")}
      title={`${state.label}: ${state.detail}`}
    >
      {content}
    </button>
  );
}

export function Sidebar({ currentPage, onNavigate }) {
  const { index } = useIndex();
  const { lastEvent, status: eventStatus } = useEventSource();
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem("praxis.sidebar.collapsed") === "true",
  );
  const [narrowDesktop, setNarrowDesktop] = useState(() => window.innerWidth < 1024);
  const isCollapsed = narrowDesktop || collapsed;
  const liveBadgeState = getLiveBadgeState(index, lastEvent);

  useEffect(() => {
    window.localStorage.setItem("praxis.sidebar.collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    function updateViewport() {
      setNarrowDesktop(window.innerWidth < 1024);
    }

    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "praxis-glass-chrome flex h-full w-14 shrink-0 flex-col items-center border-r border-[var(--praxis-line-subtle)] py-3 sm:items-stretch",
        isCollapsed ? "sm:w-14 sm:px-2" : "sm:w-[220px] sm:px-3",
      )}
    >
      <div className={cn("mb-2 flex w-full items-center", isCollapsed ? "justify-center" : "justify-end px-1")}>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-hidden={narrowDesktop ? "true" : undefined}
          tabIndex={narrowDesktop ? -1 : 0}
          className={cn("grid h-8 w-8 place-items-center rounded-[var(--praxis-radius-sm)] text-[var(--praxis-text-muted)] transition-[background-color,color,transform] duration-[var(--praxis-duration-quick)] ease-[var(--praxis-ease-out)] hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)] active:scale-[0.97]", narrowDesktop && "invisible")}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div
        className={cn(
          "flex w-full flex-1 flex-col items-center gap-1",
          isCollapsed ? "sm:items-center" : "sm:items-stretch",
        )}
      >
        {PRIMARY_NAV.map((item) => {
          const Icon = NAV_ICONS[item.id];
          const isActive =
            currentPage === item.id || (item.id === "gallery" && currentPage === "session");
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-10 items-center justify-center gap-3 rounded-[var(--praxis-radius-sm)] p-2 text-sm transition-colors",
                isCollapsed ? "sm:w-10" : "sm:w-full sm:justify-start sm:px-3 sm:py-2",
                isActive
                  ? "bg-[var(--praxis-selected)] font-medium text-[var(--praxis-text-primary)]"
                  : "text-[var(--praxis-text-muted)] hover:bg-[var(--praxis-hover)] hover:text-[var(--praxis-text-primary)]",
              )}
              title={`${item.label} · Ctrl+${item.shortcut}`}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              <span className={cn("hidden text-[13px] transition-[opacity,transform] duration-[var(--praxis-duration-pane)] ease-[var(--praxis-spring-settle)] sm:block", isCollapsed ? "sm:w-0 sm:-translate-x-2 sm:overflow-hidden sm:opacity-0" : "sm:translate-x-0 sm:opacity-100")}>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-auto flex w-full flex-col items-center gap-2",
          isCollapsed ? "sm:items-center" : "sm:items-stretch",
        )}
      >
        <ProcessingBadge
          state={liveBadgeState}
          eventStatus={eventStatus}
          onNavigate={onNavigate}
          collapsed={isCollapsed}
        />

        <button
          type="button"
          onClick={() => onNavigate("settings")}
          aria-current={currentPage === "settings" ? "page" : undefined}
          className={cn(
            "flex w-10 items-center justify-center gap-3 rounded-[var(--praxis-radius-sm)] p-2 text-sm transition-colors",
            isCollapsed ? "sm:w-10" : "sm:w-full sm:justify-start sm:px-3 sm:py-2",
            currentPage === "settings"
              ? "bg-[var(--praxis-selected)] font-medium text-[var(--praxis-text-primary)]"
              : "text-[var(--praxis-text-muted)] hover:bg-[var(--praxis-hover)] hover:text-[var(--praxis-text-primary)]",
          )}
          title="Settings · Ctrl+,"
        >
          <SettingsIcon size={18} strokeWidth={currentPage === "settings" ? 2 : 1.5} />
          <span className={cn("hidden text-[13px] transition-[opacity,transform] duration-[var(--praxis-duration-pane)] ease-[var(--praxis-spring-settle)] sm:block", isCollapsed ? "sm:w-0 sm:-translate-x-2 sm:overflow-hidden sm:opacity-0" : "sm:translate-x-0 sm:opacity-100")}>Settings</span>
        </button>
      </div>
    </nav>
  );
}
