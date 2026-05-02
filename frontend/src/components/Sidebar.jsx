import {
  AlertCircle,
  CheckCircle2,
  Flame,
  LayoutDashboard,
  Loader2,
  Mic,
  Settings as SettingsIcon,
  TrendingUp,
  Video,
} from "lucide-react";
import { useEventSource } from "../hooks/useEventSource.js";
import { useIndex } from "../hooks/useIndex.js";

const NAV_ITEMS = [
  { id: "today", icon: LayoutDashboard, label: "Today" },
  { id: "record", icon: Mic, label: "Record" },
  { id: "gallery", icon: Video, label: "Gallery" },
  { id: "trends", icon: TrendingUp, label: "Trends" },
];

const ACTIVE_STATUSES = new Set(["queued", "transcribing", "analyzing"]);
const READY_STATUSES = new Set(["ready", "done"]);
const ATTENTION_STATUSES = new Set(["needs_attention", "failed"]);

function getSessionTitle(session) {
  return session?.title?.trim() || session?.id || "Untitled";
}

function getLiveBadgeState(index, lastEvent) {
  const sessions = index?.sessions ?? [];
  const activeSessions = sessions.filter((session) => ACTIVE_STATUSES.has(session.status));
  const attentionSessions = sessions.filter((session) => ATTENTION_STATUSES.has(session.status));

  if (attentionSessions.length > 0) {
    const attentionSession = attentionSessions[0];
    return {
      kind: "attention",
      session: attentionSession,
      count: attentionSessions.length,
      label: attentionSession.status === "needs_attention" ? "Needs attention" : "Failed",
      detail: getSessionTitle(attentionSession),
    };
  }

  if (activeSessions.length > 0) {
    const activeSession = activeSessions[0];
    return {
      kind: "active",
      session: activeSession,
      count: activeSessions.length,
      label: activeSession.status === "queued" ? "Queued" : activeSession.status,
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
      label: "Ready",
      detail: getSessionTitle(readySession),
    };
  }

  return {
    kind: "idle",
    session: null,
    count: 0,
    label: "Live idle",
    detail: "No active tasks",
  };
}

function ProcessingBadge({ state, eventStatus, onNavigate }) {
  const isActionable = Boolean(state.session);
  const Icon =
    state.kind === "attention" ? AlertCircle : state.kind === "ready" ? CheckCircle2 : Loader2;
  const iconClass =
    state.kind === "attention"
      ? "text-red-400"
      : state.kind === "ready"
        ? "text-[#4ADE80]"
        : state.kind === "active"
          ? "text-[#F27D26] animate-spin"
          : "text-[#D1D1D1] opacity-45";
  const borderClass =
    state.kind === "attention"
      ? "border-red-400/35 bg-red-400/10"
      : state.kind === "ready"
        ? "border-[#4ADE80]/35 bg-[#4ADE80]/10"
        : state.kind === "active"
          ? "border-[#F27D26]/35 bg-[#F27D26]/10"
          : "border-[#2A2C31] bg-[#1C1D21]";
  const connectionLabel = eventStatus === "connected" ? "live" : eventStatus;

  const content = (
    <>
      <Icon size={15} className={`shrink-0 ${iconClass}`} />
      <div className="hidden sm:block min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#D1D1D1] opacity-50">
            {connectionLabel}
          </span>
          {state.count > 1 ? (
            <span className="text-[9px] font-mono text-white opacity-55">
              {state.count}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-[11px] font-mono uppercase tracking-wider text-white truncate">
          {state.label}
        </div>
        <div className="mt-0.5 text-[10px] text-[#D1D1D1] opacity-55 truncate">
          {state.detail}
        </div>
      </div>
    </>
  );

  if (!isActionable) {
    return (
      <div
        className={`w-10 sm:w-full min-h-10 sm:min-h-[68px] rounded-lg border ${borderClass} flex items-center justify-center sm:justify-start gap-3 p-2 sm:px-3 transition-colors`}
        title={state.detail}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate("session", { sessionId: state.session.id })}
      className={`w-10 sm:w-full min-h-10 sm:min-h-[68px] rounded-lg border ${borderClass} flex items-center justify-center sm:justify-start gap-3 p-2 sm:px-3 text-left transition-colors hover:border-white/25`}
      title={state.detail}
    >
      {content}
    </button>
  );
}

export function Sidebar({ currentPage, onNavigate }) {
  const { index } = useIndex();
  const { lastEvent, status: eventStatus } = useEventSource();
  const totalSessions = index?.totals?.sessions ?? 0;
  const currentStreak = index?.streak?.current ?? 0;
  const liveBadgeState = getLiveBadgeState(index, lastEvent);

  return (
    <nav className="w-[72px] sm:w-[240px] h-full bg-[#151619] border-r border-[#2A2C31] flex flex-col py-6 items-center sm:items-stretch sm:px-4 shrink-0">
      <div className="flex items-center justify-center sm:justify-start sm:px-2 mb-8">
        <div className="w-8 h-8 bg-white rounded flex items-center justify-center sm:mr-3">
          <div className="w-4 h-4 border-[3px] border-[#151619] border-t-transparent rounded-full" />
        </div>
        <h1 className="hidden sm:block text-white tracking-widest uppercase text-xs font-semibold">
          Praxis
        </h1>
      </div>

      <div className="flex-1 flex flex-col gap-2 sm:gap-1 w-full items-center sm:items-stretch">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id || (item.id === "gallery" && currentPage === "session");
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center justify-center sm:justify-start gap-3 p-2 sm:px-3 sm:py-2 rounded-lg text-sm transition-colors w-10 sm:w-full ${
                isActive
                  ? "bg-[#2A2C31] text-white font-medium"
                  : "text-[#E0E0E0] opacity-40 hover:opacity-100 hover:bg-[#2A2C31]/50"
              }`}
              title={item.label}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="hidden sm:block text-xs uppercase tracking-widest font-semibold">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col items-center sm:items-stretch w-full gap-2">
        <ProcessingBadge
          state={liveBadgeState}
          eventStatus={eventStatus}
          onNavigate={onNavigate}
        />

        <button
          type="button"
          onClick={() => onNavigate("settings")}
          aria-current={currentPage === "settings" ? "page" : undefined}
          className={`flex items-center justify-center sm:justify-start gap-3 p-2 sm:px-3 sm:py-2 rounded-lg text-sm transition-colors w-10 sm:w-full ${
            currentPage === "settings"
              ? "bg-[#2A2C31] text-white font-medium"
              : "text-[#E0E0E0] opacity-40 hover:opacity-100 hover:bg-[#2A2C31]/50"
          }`}
          title="Settings"
        >
          <SettingsIcon size={20} strokeWidth={currentPage === "settings" ? 2 : 1.5} />
          <span className="hidden sm:block text-xs uppercase tracking-widest font-semibold">
            Settings
          </span>
        </button>
        <div className="hidden sm:grid mt-3 grid-cols-2 gap-2 sm:px-1 font-mono">
          <div className="rounded border border-[#4ADE80]/30 bg-[#4ADE80]/10 px-2 py-2">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-[#4ADE80] opacity-80">
              <Flame size={10} className={currentStreak > 0 ? "streak-flame" : ""} />
              Streak
            </div>
            <div className="mt-1 text-sm text-white tnum">{currentStreak}d</div>
          </div>
          <div className="rounded border border-[#2A2C31] bg-[#1C1D21] px-2 py-2">
            <div className="text-[9px] uppercase tracking-widest text-[#D1D1D1] opacity-35">
              Total
            </div>
            <div className="text-sm text-white tnum">{totalSessions}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
