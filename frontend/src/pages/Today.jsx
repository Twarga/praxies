import { AlertCircle, Flame, Loader2, Mic, PlayCircle, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { loadSession, loadTodayDigest } from "../api/sessions.js";
import { StreakGrid } from "../components/StreakGrid.jsx";
import { useIndex } from "../hooks/useIndex.js";
import {
  formatDurationMinutes,
  formatShortDate,
  getProcessingLabel,
  getSessionTitle,
  isAttentionStatus,
  isProcessingStatus,
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

function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayQualifyingMinutes(sessions) {
  const todayKey = getLocalDateKey();
  const totalSeconds = (sessions ?? []).reduce((sum, session) => {
    const sessionKey = getLocalDateKey(session.created_at);
    const durationSeconds = Number(session.duration_seconds) || 0;
    if (sessionKey !== todayKey || durationSeconds < 120) return sum;
    return sum + durationSeconds;
  }, 0);

  return Math.round(totalSeconds / 60);
}

function getNextMilestone(currentStreak) {
  return [3, 7, 14, 30, 60, 100].find((milestone) => milestone > currentStreak) ?? currentStreak + 50;
}

function StreakStatusCard({ streak, sessions, onRecord }) {
  const current = Number(streak?.current) || 0;
  const longest = Number(streak?.longest) || 0;
  const todayMinutes = getTodayQualifyingMinutes(sessions);
  const hasCheckedInToday = todayMinutes >= 2;
  const nextMilestone = getNextMilestone(current);
  const progress = Math.min(100, Math.round((current / nextMilestone) * 100));
  const dayLabel = current === 1 ? "day" : "days";

  return (
    <div className="relative overflow-hidden bg-[#151619] rounded-lg border border-[#2A2C31] p-5 praxis-fade-in">
      <div className="absolute inset-0 pointer-events-none opacity-70 bg-[radial-gradient(circle_at_18%_0%,rgba(74,222,128,0.14),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(242,125,38,0.13),transparent_30%)]" />
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#4ADE80]">
            <Flame size={14} className={hasCheckedInToday ? "streak-flame" : ""} />
            Streak Engine
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-6xl sm:text-7xl leading-none font-light text-white tnum tracking-[-0.06em]">
              {current}
            </div>
            <div className="pb-2">
              <div className="text-sm uppercase tracking-widest text-white">{dayLabel}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                Longest {longest}
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-[420px] text-sm leading-relaxed text-[#D1D1D1]/75">
            {hasCheckedInToday
              ? `Locked for today with ${todayMinutes} qualifying minutes. Keep the chain visible.`
              : "Record at least 2 minutes today to protect the chain."}
          </p>
        </div>

        <button
          type="button"
          onClick={onRecord}
          className={`shrink-0 rounded-lg border px-4 py-3 text-left transition-colors ${
            hasCheckedInToday
              ? "border-[#4ADE80]/35 bg-[#4ADE80]/10 hover:bg-[#4ADE80]/15"
              : "border-[#F27D26]/35 bg-[#F27D26]/10 hover:bg-[#F27D26]/15"
          }`}
        >
          <div className="text-[9px] font-mono uppercase tracking-widest text-[#D1D1D1]/55">
            Today
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-white">
            {hasCheckedInToday ? "Checked" : "Start"}
          </div>
          <div className="mt-1 text-[10px] text-[#D1D1D1]/55">
            {hasCheckedInToday ? `${todayMinutes} min` : "2 min goal"}
          </div>
        </button>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2 font-mono">
        <div className="rounded border border-[#2A2C31] bg-[#1C1D21]/80 px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-[#D1D1D1]/35">
            Next
          </div>
          <div className="mt-1 text-sm text-white tnum">{nextMilestone}d</div>
        </div>
        <div className="rounded border border-[#2A2C31] bg-[#1C1D21]/80 px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-[#D1D1D1]/35">
            Left
          </div>
          <div className="mt-1 text-sm text-white tnum">{Math.max(nextMilestone - current, 0)}d</div>
        </div>
        <div className="rounded border border-[#2A2C31] bg-[#1C1D21]/80 px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-[#D1D1D1]/35">
            Status
          </div>
          <div className={`mt-1 text-sm tnum ${hasCheckedInToday ? "text-[#4ADE80]" : "text-[#F27D26]"}`}>
            {hasCheckedInToday ? "safe" : "open"}
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-[#D1D1D1]/40">
          <span>Milestone progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0F1012] border border-[#2A2C31]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#F27D26] to-[#4ADE80] streak-progress"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
        <Trophy size={13} className="text-[#F4B26D]" />
        Streak counts only sessions of 2+ minutes.
      </div>
    </div>
  );
}

function getFallbackBannerCopy(session, bundle) {
  const meta = bundle?.meta;
  const errorText = meta?.error || session?.error || "";
  const error = String(errorText).toLowerCase();

  if (session?.status === "video_only" || meta?.save_mode === "video_only") {
    return {
      tone: "neutral",
      eyebrow: "analysis skipped",
      title: "Saved as video only",
      body: "This take was saved without transcription or AI analysis. Open it to review the raw recording.",
      action: "Open video",
    };
  }

  if (meta?.save_mode === "transcribe_only") {
    return {
      tone: "neutral",
      eyebrow: "analysis skipped",
      title: "Transcript-only session",
      body: "This take has a transcript, but AI analysis was intentionally skipped.",
      action: "Open transcript",
    };
  }

  if (error.includes("api key") || error.includes("401") || error.includes("unauthorized")) {
    return {
      tone: "warning",
      eyebrow: "openrouter attention",
      title: "API key needs attention",
      body: "The session could not be analyzed because the OpenRouter key is missing or invalid. Fix it in Settings, then retry the session.",
      action: "Review recovery",
    };
  }

  if (error.includes("credit") || error.includes("402") || error.includes("payment")) {
    return {
      tone: "warning",
      eyebrow: "openrouter attention",
      title: "OpenRouter credits exhausted",
      body: "The transcript is saved, but analysis could not run because the account has no available credits.",
      action: "Review recovery",
    };
  }

  if (error.includes("malformed") || error.includes("json") || error.includes("schema")) {
    return {
      tone: "warning",
      eyebrow: "model output rejected",
      title: "Analysis response was malformed",
      body: "The transcript is saved, but the model returned output that did not match the required analysis schema. You can retry or import external JSON.",
      action: "Open fallback",
    };
  }

  if (session?.status === "failed") {
    return {
      tone: "danger",
      eyebrow: "processing failed",
      title: "Session processing failed",
      body: errorText || "The local pipeline failed before the session became ready. Open the session to inspect the processing log.",
      action: "Inspect session",
    };
  }

  if (session?.status === "needs_attention") {
    return {
      tone: "warning",
      eyebrow: "needs attention",
      title: "Analysis needs manual recovery",
      body: errorText || "The transcript is saved, but AI analysis needs a retry or manual import.",
      action: "Recover analysis",
    };
  }

  return null;
}

export function Today({ onNavigate, scrollRef }) {
  const { index } = useIndex();
  const sessions = index?.sessions ?? [];
  const processing = sessions.filter((s) => isProcessingStatus(s.status));
  const needsAttention = sessions.filter((s) => isAttentionStatus(s.status));
  const skippedAnalysis = sessions.filter(
    (s) => s.status === "video_only" || s.save_mode === "transcribe_only",
  );
  const fallbackSession = needsAttention[0] || skippedAnalysis[0] || null;
  const [todayDigest, setTodayDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(true);
  const [fallbackBundle, setFallbackBundle] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setDigestLoading(true);
    loadTodayDigest()
      .then((payload) => {
        if (!cancelled) setTodayDigest(payload.digest ?? null);
      })
      .catch(() => {
        if (!cancelled) setTodayDigest(null);
      })
      .finally(() => {
        if (!cancelled) setDigestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [index?.generated_at]);

  useEffect(() => {
    if (!fallbackSession) {
      setFallbackBundle(null);
      return undefined;
    }

    let cancelled = false;
    loadSession(fallbackSession.id)
      .then((bundle) => {
        if (!cancelled) setFallbackBundle(bundle);
      })
      .catch(() => {
        if (!cancelled) setFallbackBundle(null);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackSession?.id]);

  const recentSessions = sessions.filter((s) => isInLastSevenDays(s.created_at));
  const weeklyCount = recentSessions.length;
  const weeklyMinutes = Math.round(
    recentSessions.reduce((acc, s) => acc + (Number(s.duration_seconds) || 0), 0) / 60,
  );
  const totalsByLang = index?.totals?.by_language ?? {};
  const primaryLanguage = getPrimaryLanguage(totalsByLang);
  const streak = index?.streak ?? {};

  const fallbackBanner = getFallbackBannerCopy(fallbackSession, fallbackBundle);
  const digestSession = todayDigest?.session ?? null;
  const digestAnalysis = todayDigest?.analysis ?? null;
  const digestActions = (digestAnalysis?.actionable_improvements ?? []).slice(0, 3);

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
          {fallbackSession && fallbackBanner ? (
            <button
              type="button"
              onClick={() => onNavigate("session", { sessionId: fallbackSession.id })}
              className={`bg-[#151619] border rounded-lg p-5 text-left transition-colors ${
                fallbackBanner.tone === "danger"
                  ? "border-red-500/40 hover:border-red-400/70"
                  : fallbackBanner.tone === "warning"
                    ? "border-[#F27D26]/50 hover:border-[#F27D26]/80"
                    : "border-[#2A2C31] hover:border-[#4ADE80]/50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${
                    fallbackBanner.tone === "danger"
                      ? "bg-red-500/10 text-red-300"
                      : fallbackBanner.tone === "warning"
                        ? "bg-[#F27D26]/10 text-[#F27D26]"
                        : "bg-[#2A2C31] text-[#D1D1D1]"
                  }`}
                >
                  <AlertCircle size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-1">
                    {fallbackBanner.eyebrow}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {fallbackBanner.title}
                  </h3>
                  <p className="text-xs text-[#D1D1D1] opacity-75 leading-relaxed">
                    {fallbackBanner.body}
                  </p>
                  <div className="mt-4 text-[10px] font-mono uppercase tracking-widest text-[#4ADE80]">
                    {fallbackBanner.action} · {getSessionTitle(fallbackSession)}
                  </div>
                </div>
              </div>
            </button>
          ) : null}

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

          {/* Digest */}
          {digestLoading ? (
            <div className="bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-5 flex items-center gap-3">
              <Loader2 size={14} className="text-[#F27D26] animate-spin shrink-0" />
              <p className="text-[11px] font-mono uppercase tracking-widest opacity-50">
                Loading digest
              </p>
            </div>
          ) : digestSession && digestAnalysis ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
                Daily Digest
              </h3>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onNavigate("session", { sessionId: digestSession.id })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNavigate("session", { sessionId: digestSession.id });
                  }
                }}
                className="bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-5 flex flex-col gap-4 cursor-pointer hover:border-[#4ADE80] transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-semibold text-white mb-1 tracking-tight">
                      {getSessionTitle(digestSession)}
                    </h4>
                    <p className="text-[11px] font-mono opacity-50 uppercase tracking-tighter">
                      {formatShortDate(digestSession.created_at)} · {formatDurationMinutes(digestSession.duration_seconds)}
                      {todayDigest.digest_date ? ` · digest ${todayDigest.digest_date}` : ""}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded bg-[#2A2C31] flex items-center justify-center">
                    <PlayCircle size={16} className="text-white" />
                  </div>
                </div>

                {digestAnalysis.prose_verdict ? (
                  <div className="mt-1 text-sm text-[#D1D1D1] opacity-85 border-l-2 border-[#F27D26] pl-3 py-1 leading-relaxed">
                    "{digestAnalysis.prose_verdict}"
                  </div>
                ) : null}

                {digestActions.length ? (
                  <div className="border border-[#2A2C31] bg-[#151619] rounded p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-3">
                      Next actions
                    </div>
                    <div className="space-y-2">
                      {digestActions.map((action, index) => (
                        <div key={`${action}-${index}`} className="flex gap-3 text-xs text-[#D1D1D1]">
                          <span className="font-mono text-[#4ADE80] opacity-80">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="leading-relaxed">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">
                Daily Digest
              </h3>
              <p className="text-sm text-[#D1D1D1] opacity-75 leading-relaxed">
                No analyzed session is ready for a digest yet. Record and process a session to unlock this card.
              </p>
            </div>
          )}
        </div>

        {/* Side column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <StreakStatusCard
            streak={streak}
            sessions={sessions}
            onRecord={() => onNavigate("record")}
          />

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
                <div className="text-xl font-light text-white tnum">{streak.current ?? 0}</div>
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

          <div className="bg-[#151619] rounded-lg border border-[#2A2C31] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
                Streak Grid
              </h3>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#4ADE80]">
                {streak.current ?? 0} day
              </div>
            </div>
            <StreakGrid sessions={sessions} />
          </div>
        </div>
      </div>
    </div>
  );
}
