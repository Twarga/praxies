import { AlertCircle, Loader2, Mic, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { loadSession } from "../api/sessions.js";
import { useIndex } from "../hooks/useIndex.js";
import {
  formatDurationMinutes,
  formatShortDate,
  getProcessingLabel,
  getSessionTitle,
  isAttentionStatus,
  isProcessingStatus,
  isReadyStatus,
} from "../lib/sessionUi.js";

function isInLastSevenDays(value) {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 7 * 24 * 60 * 60 * 1000;
}

function getPrimaryLanguage(byLanguage) {
  if (!byLanguage) return "—";
  const entries = Object.entries(byLanguage);
  if (!entries.length) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  const [code] = entries[0];
  if (code === "en") return "EN-US";
  if (code === "fr") return "FR-FR";
  if (code === "es") return "ES-ES";
  return code.toUpperCase();
}

export function Today({ onNavigate, scrollRef }) {
  const { index } = useIndex();
  const sessions = index?.sessions ?? [];
  const processing = sessions.filter((s) => isProcessingStatus(s.status));
  const needsAttention = sessions.filter((s) => isAttentionStatus(s.status));
  const latestReady = sessions.find((s) => isReadyStatus(s.status));
  const [latestBundle, setLatestBundle] = useState(null);

  useEffect(() => {
    if (!latestReady) {
      setLatestBundle(null);
      return undefined;
    }

    let cancelled = false;
    loadSession(latestReady.id)
      .then((bundle) => {
        if (!cancelled) setLatestBundle(bundle);
      })
      .catch(() => {
        if (!cancelled) setLatestBundle(null);
      });

    return () => {
      cancelled = true;
    };
  }, [latestReady?.id]);

  const recentSessions = sessions.filter((s) => isInLastSevenDays(s.created_at));
  const weeklyCount = recentSessions.length;
  const weeklyMinutes = Math.round(
    recentSessions.reduce((acc, s) => acc + (Number(s.duration_seconds) || 0), 0) / 60,
  );
  const totalsByLang = index?.totals?.by_language ?? {};
  const primaryLanguage = getPrimaryLanguage(totalsByLang);

  const summaryText =
    latestBundle?.analysis?.session_summary ||
    latestBundle?.analysis?.prose_verdict ||
    null;

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto">
      <header className="h-16 border-b border-[#2A2C31] flex items-center px-8 bg-[#151619] shrink-0 justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-white">Today's Overview</h2>
        <div className="px-2 py-0.5 rounded bg-[#2A2C31] text-[#E0E0E0] text-[10px] font-mono uppercase tracking-widest">
          {processing.length} Processing
        </div>
      </header>

      <div className="px-8 max-w-5xl w-full mx-auto grid grid-cols-12 gap-6 py-8">
        {/* Main column */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          {/* Primary action */}
          <button
            type="button"
            onClick={() => onNavigate("record")}
            className="bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#2A2C31] transition-colors group"
          >
            <div className="w-12 h-12 rounded bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Mic className="text-white" size={20} />
            </div>
            <h3 className="text-sm font-semibold tracking-wide text-white mb-1">
              Start New Recording
            </h3>
            <p className="text-xs text-[#D1D1D1] opacity-70">
              Capture your thoughts, practice a presentation, or journal.
            </p>
          </button>

          {/* Latest session */}
          {latestReady && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
                Latest Session
              </h3>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onNavigate("session", { sessionId: latestReady.id })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNavigate("session", { sessionId: latestReady.id });
                  }
                }}
                className="bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-5 flex flex-col gap-4 cursor-pointer hover:border-[#4ADE80] transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-semibold text-white mb-1 tracking-tight">
                      {getSessionTitle(latestReady)}
                    </h4>
                    <p className="text-[11px] font-mono opacity-50 uppercase tracking-tighter">
                      {formatShortDate(latestReady.created_at)} · {formatDurationMinutes(latestReady.duration_seconds)}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded bg-[#2A2C31] flex items-center justify-center">
                    <PlayCircle size={16} className="text-white" />
                  </div>
                </div>

                {summaryText ? (
                  <div className="mt-1 text-sm text-[#D1D1D1] italic opacity-80 border-l-2 border-[#F27D26] pl-3 py-1">
                    "{summaryText}"
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Side column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Queue */}
          <div className="bg-[#151619] border border-[#2A2C31] rounded-lg p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4">
              Queue
            </h3>
            {processing.length === 0 && needsAttention.length === 0 ? (
              <p className="text-[11px] font-mono opacity-50 uppercase tracking-tighter">
                No active tasks.
              </p>
            ) : null}

            <div className="space-y-3">
              {processing.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onNavigate("session", { sessionId: s.id })}
                  className="w-full flex items-center gap-3 hover:bg-[#1C1D21] rounded p-1 -m-1 transition-colors text-left"
                >
                  <Loader2 size={14} className="text-[#F27D26] animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {getSessionTitle(s)}
                    </p>
                    <p className="text-[10px] font-mono opacity-50 uppercase tracking-tighter">
                      {getProcessingLabel(s.status)}
                    </p>
                  </div>
                </button>
              ))}
              {needsAttention.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onNavigate("session", { sessionId: s.id })}
                  className="w-full flex items-center gap-3 p-2 bg-[#2A2C31]/50 hover:bg-[#2A2C31] rounded transition-colors text-left"
                >
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {getSessionTitle(s)}
                    </p>
                    <p className="text-[10px] font-mono text-red-400 uppercase tracking-tighter">
                      {s.status === "needs_attention"
                        ? "Needs attention"
                        : "Failed processing"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* This week */}
          <div className="bg-[#151619] rounded-lg border border-[#2A2C31] p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4">
              This Week
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#2A2C31] bg-[#1C1D21] p-3 rounded">
                <div className="text-[10px] opacity-40 uppercase mb-1 font-mono">
                  Sessions
                </div>
                <div className="text-xl font-light text-white tnum">{weeklyCount}</div>
              </div>
              <div className="border border-[#2A2C31] bg-[#1C1D21] p-3 rounded">
                <div className="text-[10px] opacity-40 uppercase mb-1 font-mono">
                  Min Spoke
                </div>
                <div className="text-xl font-light text-white tnum">{weeklyMinutes}</div>
              </div>
              <div className="border border-[#2A2C31] bg-[#1C1D21] p-3 rounded">
                <div className="text-[10px] opacity-40 uppercase mb-1 font-mono">
                  Streak
                </div>
                <div className="text-xl font-light text-white tnum">
                  {index?.streak?.current ?? 0}
                </div>
              </div>
              <div className="border border-[#2A2C31] bg-[#1C1D21] p-3 rounded">
                <div className="text-[10px] opacity-40 uppercase mb-1 font-mono">
                  Pri Lang
                </div>
                <div className="text-xl font-light text-white truncate">
                  {primaryLanguage}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
